-- ================================================================
-- ジャージ使用回数（通算 + クリーニング目安）+ クリーニング記録
-- ================================================================

ALTER TABLE jersey_inventory
  ADD COLUMN uses_since_clean SMALLINT NOT NULL DEFAULT 0 CHECK (uses_since_clean >= 0),
  ADD COLUMN total_uses        INTEGER  NOT NULL DEFAULT 0 CHECK (total_uses >= 0),
  ADD COLUMN last_cleaned_at   TIMESTAMPTZ;

COMMENT ON COLUMN jersey_inventory.uses_since_clean IS '前回クリーニング以降の使用回数（しきい値3で洗濯推奨）';
COMMENT ON COLUMN jersey_inventory.total_uses IS '通算使用回数（人気分析用・リセットしない）';

ALTER TYPE retail_log_action ADD VALUE IF NOT EXISTS 'jersey_cleaned';

CREATE TABLE jersey_cleaning_logs (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  jersey_item_id   UUID        NOT NULL REFERENCES jersey_items(id) ON DELETE RESTRICT,
  size             jersey_size NOT NULL,
  uses_before_clean SMALLINT   NOT NULL,
  total_uses_at_clean INTEGER  NOT NULL,
  operator_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  cleaned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_jersey_cleaning_logs_item ON jersey_cleaning_logs (jersey_item_id, size, cleaned_at DESC);

ALTER TABLE jersey_cleaning_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "retail_select_jersey_cleaning_logs" ON jersey_cleaning_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 既存の貸出履歴から通算・洗濯後回数を初期化
UPDATE jersey_inventory inv
SET
  total_uses = COALESCE((
    SELECT COUNT(*)::INTEGER
    FROM jersey_rentals r
    WHERE r.jersey_item_id = inv.jersey_item_id
      AND r.size = inv.size
      AND r.status IN ('rented', 'returned')
  ), 0),
  uses_since_clean = COALESCE((
    SELECT COUNT(*)::INTEGER
    FROM jersey_rentals r
    WHERE r.jersey_item_id = inv.jersey_item_id
      AND r.size = inv.size
      AND r.status IN ('rented', 'returned')
  ), 0);

-- ----------------------------------------------------------------
-- 貸出 RPC（使用回数 +1）
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION rent_jersey(
  p_jersey_item_id   UUID,
  p_size             jersey_size,
  p_rental_type      jersey_rental_type,
  p_session_start_at TIMESTAMPTZ,
  p_operator_id      UUID
)
RETURNS jersey_rentals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_business_date DATE := retail_business_date(NOW());
  v_seq           INTEGER;
  v_order_number  TEXT;
  v_qty           SMALLINT;
  v_rental        jersey_rentals;
  v_group_code    TEXT;
  v_item_label    TEXT;
BEGIN
  IF p_operator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'operator mismatch';
  END IF;

  SELECT quantity INTO v_qty
  FROM jersey_inventory
  WHERE jersey_item_id = p_jersey_item_id AND size = p_size
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory not found';
  END IF;

  IF v_qty <= 0 THEN
    RAISE EXCEPTION 'out of stock';
  END IF;

  SELECT COALESCE(MAX(
    NULLIF(SPLIT_PART(order_number, '-', 2), '')::INTEGER
  ), 0) + 1
  INTO v_seq
  FROM jersey_rentals
  WHERE business_date = v_business_date;

  v_order_number := to_char(v_business_date, 'YYYYMMDD') || '-' || lpad(v_seq::TEXT, 4, '0');

  UPDATE jersey_inventory
  SET
    quantity = quantity - 1,
    uses_since_clean = uses_since_clean + 1,
    total_uses = total_uses + 1
  WHERE jersey_item_id = p_jersey_item_id AND size = p_size;

  INSERT INTO jersey_rentals (
    order_number, business_date, jersey_item_id, size,
    rental_type, session_start_at, operator_id
  )
  VALUES (
    v_order_number, v_business_date, p_jersey_item_id, p_size,
    p_rental_type, p_session_start_at, p_operator_id
  )
  RETURNING * INTO v_rental;

  SELECT jg.code, ji.label
  INTO v_group_code, v_item_label
  FROM jersey_items ji
  JOIN jersey_groups jg ON jg.id = ji.group_id
  WHERE ji.id = p_jersey_item_id;

  INSERT INTO retail_operation_logs (
    business_date, action, target_type, target_id, snapshot, operator_id
  )
  VALUES (
    v_business_date,
    'jersey_rent',
    'jersey_rentals',
    v_rental.id,
    jsonb_build_object(
      'rental', row_to_json(v_rental),
      'group_code', v_group_code,
      'item_label', v_item_label,
      'inventory_before', v_qty,
      'inventory_after', v_qty - 1
    ),
    p_operator_id
  );

  RETURN v_rental;
END;
$$;

-- ----------------------------------------------------------------
-- クリーニング済 RPC（洗濯後回数のみリセット）
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION mark_jersey_cleaned(
  p_jersey_item_id UUID,
  p_size           jersey_size,
  p_operator_id    UUID
)
RETURNS jersey_inventory
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv           jersey_inventory;
  v_business_date DATE := retail_business_date(NOW());
  v_group_code    TEXT;
  v_item_label    TEXT;
  v_uses_before   SMALLINT;
BEGIN
  IF p_operator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'operator mismatch';
  END IF;

  SELECT * INTO v_inv
  FROM jersey_inventory
  WHERE jersey_item_id = p_jersey_item_id AND size = p_size
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'inventory not found';
  END IF;

  v_uses_before := v_inv.uses_since_clean;

  UPDATE jersey_inventory
  SET uses_since_clean = 0, last_cleaned_at = NOW()
  WHERE jersey_item_id = p_jersey_item_id AND size = p_size
  RETURNING * INTO v_inv;

  INSERT INTO jersey_cleaning_logs (
    jersey_item_id, size, uses_before_clean, total_uses_at_clean, operator_id
  )
  VALUES (
    p_jersey_item_id, p_size, v_uses_before, v_inv.total_uses, p_operator_id
  );

  SELECT jg.code, ji.label
  INTO v_group_code, v_item_label
  FROM jersey_items ji
  JOIN jersey_groups jg ON jg.id = ji.group_id
  WHERE ji.id = p_jersey_item_id;

  INSERT INTO retail_operation_logs (
    business_date, action, target_type, target_id, snapshot, operator_id
  )
  VALUES (
    v_business_date,
    'jersey_cleaned',
    'jersey_inventory',
    NULL,
    jsonb_build_object(
      'jersey_item_id', p_jersey_item_id,
      'size', p_size,
      'group_code', v_group_code,
      'item_label', v_item_label,
      'uses_before_clean', v_uses_before,
      'total_uses', v_inv.total_uses
    ),
    p_operator_id
  );

  RETURN v_inv;
END;
$$;

-- ----------------------------------------------------------------
-- 巻き戻し: 貸出取消時に使用回数も -1
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION rollback_retail_operation(
  p_log_id      UUID,
  p_operator_id UUID
)
RETURNS retail_operation_logs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log       retail_operation_logs;
  v_rental    jersey_rentals;
  v_rental_id UUID;
  v_item_id   UUID;
  v_size      jersey_size;
  v_change    JSONB;
  v_before    ib_ticket_daily_totals;
  v_uses_before SMALLINT;
BEGIN
  IF p_operator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'operator mismatch';
  END IF;

  SELECT * INTO v_log
  FROM retail_operation_logs
  WHERE id = p_log_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'log not found';
  END IF;

  IF v_log.rolled_back_at IS NOT NULL THEN
    RAISE EXCEPTION 'already rolled back';
  END IF;

  IF v_log.action = 'rollback' THEN
    RAISE EXCEPTION 'cannot rollback a rollback entry';
  END IF;

  CASE v_log.action
    WHEN 'jersey_rent' THEN
      v_rental_id := (v_log.snapshot->'rental'->>'id')::UUID;
      v_item_id   := (v_log.snapshot->'rental'->>'jersey_item_id')::UUID;
      v_size      := (v_log.snapshot->'rental'->>'size')::jersey_size;

      SELECT * INTO v_rental
      FROM jersey_rentals
      WHERE id = v_rental_id
      FOR UPDATE;

      IF NOT FOUND OR v_rental.status <> 'rented' THEN
        RAISE EXCEPTION 'rental is not active';
      END IF;

      UPDATE jersey_rentals
      SET status = 'cancelled'
      WHERE id = v_rental_id;

      UPDATE jersey_inventory
      SET
        quantity = (v_log.snapshot->>'inventory_before')::SMALLINT,
        uses_since_clean = GREATEST(uses_since_clean - 1, 0),
        total_uses = GREATEST(total_uses - 1, 0)
      WHERE jersey_item_id = v_item_id AND size = v_size;

    WHEN 'jersey_return' THEN
      v_rental_id := (v_log.snapshot->'rental'->>'id')::UUID;
      v_item_id   := (v_log.snapshot->'rental'->>'jersey_item_id')::UUID;
      v_size      := (v_log.snapshot->'rental'->>'size')::jersey_size;

      SELECT * INTO v_rental
      FROM jersey_rentals
      WHERE id = v_rental_id
      FOR UPDATE;

      IF NOT FOUND OR v_rental.status <> 'returned' THEN
        RAISE EXCEPTION 'rental is not returned';
      END IF;

      UPDATE jersey_rentals
      SET status = 'rented', returned_at = NULL
      WHERE id = v_rental_id;

      UPDATE jersey_inventory
      SET quantity = (v_log.snapshot->>'inventory_before')::SMALLINT
      WHERE jersey_item_id = v_item_id AND size = v_size;

    WHEN 'jersey_inventory_update' THEN
      FOR v_change IN SELECT * FROM jsonb_array_elements(v_log.snapshot->'changes')
      LOOP
        UPDATE jersey_inventory
        SET quantity = (v_change->>'before')::SMALLINT
        WHERE jersey_item_id = (v_change->>'jersey_item_id')::UUID
          AND size = (v_change->>'size')::jersey_size;
      END LOOP;

    WHEN 'jersey_cleaned' THEN
      v_item_id := (v_log.snapshot->>'jersey_item_id')::UUID;
      v_size    := (v_log.snapshot->>'size')::jersey_size;
      v_uses_before := (v_log.snapshot->>'uses_before_clean')::SMALLINT;

      UPDATE jersey_inventory
      SET uses_since_clean = v_uses_before
      WHERE jersey_item_id = v_item_id AND size = v_size;

    WHEN 'ib_ticket_add', 'ib_ticket_edit' THEN
      v_before := jsonb_populate_record(NULL::ib_ticket_daily_totals, v_log.snapshot->'before');
      PERFORM ensure_ib_ticket_daily_totals(v_log.business_date);
      UPDATE ib_ticket_daily_totals
      SET
        gen_weekday_count       = v_before.gen_weekday_count,
        gen_holiday_count       = v_before.gen_holiday_count,
        child_weekday_count     = v_before.child_weekday_count,
        child_holiday_count     = v_before.child_holiday_count,
        gen_vip_weekday_count   = v_before.gen_vip_weekday_count,
        gen_vip_holiday_count   = v_before.gen_vip_holiday_count,
        child_vip_weekday_count = v_before.child_vip_weekday_count,
        child_vip_holiday_count = v_before.child_vip_holiday_count,
        vip_count               = v_before.vip_count
      WHERE business_date = v_log.business_date;

    ELSE
      RAISE EXCEPTION 'unsupported action: %', v_log.action;
  END CASE;

  UPDATE retail_operation_logs
  SET rolled_back_at = NOW(), rolled_back_by = p_operator_id
  WHERE id = p_log_id;

  INSERT INTO retail_operation_logs (
    business_date, action, target_type, target_id, snapshot, operator_id
  )
  VALUES (
    v_log.business_date,
    'rollback',
    'retail_operation_logs',
    p_log_id,
    jsonb_build_object('original_log_id', p_log_id, 'original_action', v_log.action),
    p_operator_id
  );

  SELECT * INTO v_log FROM retail_operation_logs WHERE id = p_log_id;
  RETURN v_log;
END;
$$;

GRANT EXECUTE ON FUNCTION mark_jersey_cleaned(UUID, jersey_size, UUID) TO authenticated;
