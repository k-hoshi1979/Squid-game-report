-- ================================================================
-- SNS投稿（〇・▢）日次集計 — RETAIL業務アプリ ↔ 日報連携
-- ================================================================

ALTER TYPE retail_log_action ADD VALUE IF NOT EXISTS 'sns_post_add';
ALTER TYPE retail_log_action ADD VALUE IF NOT EXISTS 'sns_post_edit';

CREATE TABLE sns_post_daily_totals (
  business_date  DATE        PRIMARY KEY,
  circle_count   SMALLINT    NOT NULL DEFAULT 0 CHECK (circle_count >= 0),
  square_count   SMALLINT    NOT NULL DEFAULT 0 CHECK (square_count >= 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE sns_post_daily_totals IS 'SNS投稿（〇・▢）の日次枚数';

CREATE TRIGGER sns_post_daily_totals_updated_at
  BEFORE UPDATE ON sns_post_daily_totals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION ensure_sns_post_daily_totals(p_business_date DATE)
RETURNS sns_post_daily_totals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row sns_post_daily_totals;
BEGIN
  INSERT INTO sns_post_daily_totals (business_date)
  VALUES (p_business_date)
  ON CONFLICT (business_date) DO NOTHING;

  SELECT * INTO v_row
  FROM sns_post_daily_totals
  WHERE business_date = p_business_date;

  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION add_sns_post_counts(
  p_business_date DATE,
  p_circle_delta  SMALLINT,
  p_square_delta  SMALLINT,
  p_operator_id   UUID
)
RETURNS sns_post_daily_totals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before sns_post_daily_totals;
  v_after  sns_post_daily_totals;
BEGIN
  IF p_operator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'operator mismatch';
  END IF;

  IF COALESCE(p_circle_delta, 0) < 0 OR COALESCE(p_square_delta, 0) < 0 THEN
    RAISE EXCEPTION 'delta must be >= 0';
  END IF;

  IF COALESCE(p_circle_delta, 0) = 0 AND COALESCE(p_square_delta, 0) = 0 THEN
    RAISE EXCEPTION 'at least one delta must be > 0';
  END IF;

  v_before := ensure_sns_post_daily_totals(p_business_date);

  UPDATE sns_post_daily_totals
  SET
    circle_count = circle_count + COALESCE(p_circle_delta, 0),
    square_count = square_count + COALESCE(p_square_delta, 0)
  WHERE business_date = p_business_date;

  SELECT * INTO v_after FROM sns_post_daily_totals WHERE business_date = p_business_date;

  INSERT INTO retail_operation_logs (
    business_date, action, target_type, target_id, snapshot, operator_id
  )
  VALUES (
    p_business_date,
    'sns_post_add',
    'sns_post_daily_totals',
    NULL,
    jsonb_build_object(
      'before', row_to_json(v_before),
      'after', row_to_json(v_after),
      'circle_delta', COALESCE(p_circle_delta, 0),
      'square_delta', COALESCE(p_square_delta, 0)
    ),
    p_operator_id
  );

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION edit_sns_post_counts(
  p_business_date DATE,
  p_circle_count  SMALLINT,
  p_square_count  SMALLINT,
  p_operator_id   UUID
)
RETURNS sns_post_daily_totals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before sns_post_daily_totals;
  v_after  sns_post_daily_totals;
BEGIN
  IF p_operator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'operator mismatch';
  END IF;

  IF COALESCE(p_circle_count, 0) < 0 OR COALESCE(p_square_count, 0) < 0 THEN
    RAISE EXCEPTION 'count must be >= 0';
  END IF;

  v_before := ensure_sns_post_daily_totals(p_business_date);

  UPDATE sns_post_daily_totals
  SET
    circle_count = COALESCE(p_circle_count, 0),
    square_count = COALESCE(p_square_count, 0)
  WHERE business_date = p_business_date;

  SELECT * INTO v_after FROM sns_post_daily_totals WHERE business_date = p_business_date;

  INSERT INTO retail_operation_logs (
    business_date, action, target_type, target_id, snapshot, operator_id
  )
  VALUES (
    p_business_date,
    'sns_post_edit',
    'sns_post_daily_totals',
    NULL,
    jsonb_build_object('before', row_to_json(v_before), 'after', row_to_json(v_after)),
    p_operator_id
  );

  RETURN v_after;
END;
$$;

CREATE OR REPLACE VIEW retail_daily_report_export AS
WITH dates AS (
  SELECT business_date FROM (
    SELECT business_date FROM jersey_rentals GROUP BY business_date
    UNION
    SELECT business_date FROM ib_ticket_daily_totals
    UNION
    SELECT business_date FROM sns_post_daily_totals
  ) d
)
SELECT
  d.business_date,
  COALESCE(j.jersey_normal_count, 0)          AS jersey_normal_count,
  COALESCE(j.jersey_sns_count, 0)             AS jersey_sns_count,
  COALESCE(ib.gen_weekday_count, 0)           AS ib_gen_weekday_count,
  COALESCE(ib.gen_holiday_count, 0)           AS ib_gen_holiday_count,
  COALESCE(ib.child_weekday_count, 0)         AS ib_child_weekday_count,
  COALESCE(ib.child_holiday_count, 0)         AS ib_child_holiday_count,
  COALESCE(ib.gen_vip_weekday_count, 0)       AS ib_gen_vip_weekday_count,
  COALESCE(ib.gen_vip_holiday_count, 0)       AS ib_gen_vip_holiday_count,
  COALESCE(ib.child_vip_weekday_count, 0)     AS ib_child_vip_weekday_count,
  COALESCE(ib.child_vip_holiday_count, 0)     AS ib_child_vip_holiday_count,
  COALESCE(ib.vip_count, 0)                   AS ib_vip_count,
  COALESCE(sns.circle_count, 0)               AS sns_circle_count,
  COALESCE(sns.square_count, 0)               AS sns_square_count
FROM dates d
LEFT JOIN (
  SELECT
    business_date,
    COUNT(*) FILTER (
      WHERE rental_type = 'normal'
        AND status IN ('rented', 'returned')
    )::SMALLINT AS jersey_normal_count,
    COUNT(*) FILTER (
      WHERE rental_type = 'sns'
        AND status IN ('rented', 'returned')
    )::SMALLINT AS jersey_sns_count
  FROM jersey_rentals
  GROUP BY business_date
) j ON d.business_date = j.business_date
LEFT JOIN ib_ticket_daily_totals ib ON d.business_date = ib.business_date
LEFT JOIN sns_post_daily_totals sns ON d.business_date = sns.business_date;

ALTER VIEW retail_daily_report_export SET (security_invoker = true);

ALTER TABLE sns_post_daily_totals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "retail_select_sns_post_daily_totals" ON sns_post_daily_totals
  FOR SELECT TO authenticated USING (true);

GRANT EXECUTE ON FUNCTION ensure_sns_post_daily_totals(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION add_sns_post_counts(DATE, SMALLINT, SMALLINT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION edit_sns_post_counts(DATE, SMALLINT, SMALLINT, UUID) TO authenticated;

-- 巻き戻し対応
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
  v_sns_before sns_post_daily_totals;
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

    WHEN 'sns_post_add', 'sns_post_edit' THEN
      v_sns_before := jsonb_populate_record(NULL::sns_post_daily_totals, v_log.snapshot->'before');
      PERFORM ensure_sns_post_daily_totals(v_log.business_date);
      UPDATE sns_post_daily_totals
      SET
        circle_count = v_sns_before.circle_count,
        square_count = v_sns_before.square_count
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
