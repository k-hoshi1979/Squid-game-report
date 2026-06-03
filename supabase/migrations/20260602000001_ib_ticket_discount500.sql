-- IB【500円引き】8券種の追加（日報・RETAIL業務アプリ連携）

ALTER TYPE ib_ticket_type ADD VALUE IF NOT EXISTS 'gen_weekday_discount500';
ALTER TYPE ib_ticket_type ADD VALUE IF NOT EXISTS 'gen_holiday_discount500';
ALTER TYPE ib_ticket_type ADD VALUE IF NOT EXISTS 'child_weekday_discount500';
ALTER TYPE ib_ticket_type ADD VALUE IF NOT EXISTS 'child_holiday_discount500';
ALTER TYPE ib_ticket_type ADD VALUE IF NOT EXISTS 'gen_vip_weekday_discount500';
ALTER TYPE ib_ticket_type ADD VALUE IF NOT EXISTS 'gen_vip_holiday_discount500';
ALTER TYPE ib_ticket_type ADD VALUE IF NOT EXISTS 'child_vip_weekday_discount500';
ALTER TYPE ib_ticket_type ADD VALUE IF NOT EXISTS 'child_vip_holiday_discount500';

ALTER TABLE ib_ticket_daily_totals
  ADD COLUMN IF NOT EXISTS gen_weekday_discount500_count SMALLINT NOT NULL DEFAULT 0
    CHECK (gen_weekday_discount500_count >= 0),
  ADD COLUMN IF NOT EXISTS gen_holiday_discount500_count SMALLINT NOT NULL DEFAULT 0
    CHECK (gen_holiday_discount500_count >= 0),
  ADD COLUMN IF NOT EXISTS child_weekday_discount500_count SMALLINT NOT NULL DEFAULT 0
    CHECK (child_weekday_discount500_count >= 0),
  ADD COLUMN IF NOT EXISTS child_holiday_discount500_count SMALLINT NOT NULL DEFAULT 0
    CHECK (child_holiday_discount500_count >= 0),
  ADD COLUMN IF NOT EXISTS gen_vip_weekday_discount500_count SMALLINT NOT NULL DEFAULT 0
    CHECK (gen_vip_weekday_discount500_count >= 0),
  ADD COLUMN IF NOT EXISTS gen_vip_holiday_discount500_count SMALLINT NOT NULL DEFAULT 0
    CHECK (gen_vip_holiday_discount500_count >= 0),
  ADD COLUMN IF NOT EXISTS child_vip_weekday_discount500_count SMALLINT NOT NULL DEFAULT 0
    CHECK (child_vip_weekday_discount500_count >= 0),
  ADD COLUMN IF NOT EXISTS child_vip_holiday_discount500_count SMALLINT NOT NULL DEFAULT 0
    CHECK (child_vip_holiday_discount500_count >= 0);

CREATE OR REPLACE FUNCTION add_ib_tickets(
  p_business_date DATE,
  p_deltas        JSONB,
  p_operator_id   UUID
)
RETURNS ib_ticket_daily_totals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item   JSONB;
  v_type   ib_ticket_type;
  v_delta  SMALLINT;
  v_before ib_ticket_daily_totals;
  v_after  ib_ticket_daily_totals;
BEGIN
  IF p_operator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'operator mismatch';
  END IF;

  v_before := ensure_ib_ticket_daily_totals(p_business_date);

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_deltas)
  LOOP
    v_type  := (v_item->>'ticket_type')::ib_ticket_type;
    v_delta := COALESCE((v_item->>'delta_count')::SMALLINT, 0);

    IF v_delta = 0 THEN
      CONTINUE;
    END IF;

    IF v_delta < 0 THEN
      RAISE EXCEPTION 'delta_count must be >= 0 for add mode';
    END IF;

    UPDATE ib_ticket_daily_totals
    SET
      gen_weekday_count = gen_weekday_count + CASE WHEN v_type = 'gen_weekday' THEN v_delta ELSE 0 END,
      gen_holiday_count = gen_holiday_count + CASE WHEN v_type = 'gen_holiday' THEN v_delta ELSE 0 END,
      child_weekday_count = child_weekday_count + CASE WHEN v_type = 'child_weekday' THEN v_delta ELSE 0 END,
      child_holiday_count = child_holiday_count + CASE WHEN v_type = 'child_holiday' THEN v_delta ELSE 0 END,
      gen_vip_weekday_count = gen_vip_weekday_count + CASE WHEN v_type = 'gen_vip_weekday' THEN v_delta ELSE 0 END,
      gen_vip_holiday_count = gen_vip_holiday_count + CASE WHEN v_type = 'gen_vip_holiday' THEN v_delta ELSE 0 END,
      child_vip_weekday_count = child_vip_weekday_count + CASE WHEN v_type = 'child_vip_weekday' THEN v_delta ELSE 0 END,
      child_vip_holiday_count = child_vip_holiday_count + CASE WHEN v_type = 'child_vip_holiday' THEN v_delta ELSE 0 END,
      vip_count = vip_count + CASE WHEN v_type = 'vip' THEN v_delta ELSE 0 END,
      gen_weekday_discount500_count = gen_weekday_discount500_count + CASE WHEN v_type = 'gen_weekday_discount500' THEN v_delta ELSE 0 END,
      gen_holiday_discount500_count = gen_holiday_discount500_count + CASE WHEN v_type = 'gen_holiday_discount500' THEN v_delta ELSE 0 END,
      child_weekday_discount500_count = child_weekday_discount500_count + CASE WHEN v_type = 'child_weekday_discount500' THEN v_delta ELSE 0 END,
      child_holiday_discount500_count = child_holiday_discount500_count + CASE WHEN v_type = 'child_holiday_discount500' THEN v_delta ELSE 0 END,
      gen_vip_weekday_discount500_count = gen_vip_weekday_discount500_count + CASE WHEN v_type = 'gen_vip_weekday_discount500' THEN v_delta ELSE 0 END,
      gen_vip_holiday_discount500_count = gen_vip_holiday_discount500_count + CASE WHEN v_type = 'gen_vip_holiday_discount500' THEN v_delta ELSE 0 END,
      child_vip_weekday_discount500_count = child_vip_weekday_discount500_count + CASE WHEN v_type = 'child_vip_weekday_discount500' THEN v_delta ELSE 0 END,
      child_vip_holiday_discount500_count = child_vip_holiday_discount500_count + CASE WHEN v_type = 'child_vip_holiday_discount500' THEN v_delta ELSE 0 END
    WHERE business_date = p_business_date;

    INSERT INTO ib_ticket_entries (business_date, ticket_type, delta_count, entry_mode, operator_id)
    VALUES (p_business_date, v_type, v_delta, 'add', p_operator_id);
  END LOOP;

  SELECT * INTO v_after FROM ib_ticket_daily_totals WHERE business_date = p_business_date;

  INSERT INTO retail_operation_logs (
    business_date, action, target_type, target_id, snapshot, operator_id
  )
  VALUES (
    p_business_date,
    'ib_ticket_add',
    'ib_ticket_daily_totals',
    NULL,
    jsonb_build_object('before', row_to_json(v_before), 'after', row_to_json(v_after), 'deltas', p_deltas),
    p_operator_id
  );

  RETURN v_after;
END;
$$;

CREATE OR REPLACE FUNCTION edit_ib_tickets(
  p_business_date DATE,
  p_totals        JSONB,
  p_operator_id   UUID
)
RETURNS ib_ticket_daily_totals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_before ib_ticket_daily_totals;
  v_after  ib_ticket_daily_totals;
  v_type   ib_ticket_type;
  v_new    SMALLINT;
  v_old    SMALLINT;
  v_delta  SMALLINT;
BEGIN
  IF p_operator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'operator mismatch';
  END IF;

  v_before := ensure_ib_ticket_daily_totals(p_business_date);

  UPDATE ib_ticket_daily_totals
  SET
    gen_weekday_count = COALESCE((p_totals->>'gen_weekday_count')::SMALLINT, gen_weekday_count),
    gen_holiday_count = COALESCE((p_totals->>'gen_holiday_count')::SMALLINT, gen_holiday_count),
    child_weekday_count = COALESCE((p_totals->>'child_weekday_count')::SMALLINT, child_weekday_count),
    child_holiday_count = COALESCE((p_totals->>'child_holiday_count')::SMALLINT, child_holiday_count),
    gen_vip_weekday_count = COALESCE((p_totals->>'gen_vip_weekday_count')::SMALLINT, gen_vip_weekday_count),
    gen_vip_holiday_count = COALESCE((p_totals->>'gen_vip_holiday_count')::SMALLINT, gen_vip_holiday_count),
    child_vip_weekday_count = COALESCE((p_totals->>'child_vip_weekday_count')::SMALLINT, child_vip_weekday_count),
    child_vip_holiday_count = COALESCE((p_totals->>'child_vip_holiday_count')::SMALLINT, child_vip_holiday_count),
    vip_count = COALESCE((p_totals->>'vip_count')::SMALLINT, vip_count),
    gen_weekday_discount500_count = COALESCE((p_totals->>'gen_weekday_discount500_count')::SMALLINT, gen_weekday_discount500_count),
    gen_holiday_discount500_count = COALESCE((p_totals->>'gen_holiday_discount500_count')::SMALLINT, gen_holiday_discount500_count),
    child_weekday_discount500_count = COALESCE((p_totals->>'child_weekday_discount500_count')::SMALLINT, child_weekday_discount500_count),
    child_holiday_discount500_count = COALESCE((p_totals->>'child_holiday_discount500_count')::SMALLINT, child_holiday_discount500_count),
    gen_vip_weekday_discount500_count = COALESCE((p_totals->>'gen_vip_weekday_discount500_count')::SMALLINT, gen_vip_weekday_discount500_count),
    gen_vip_holiday_discount500_count = COALESCE((p_totals->>'gen_vip_holiday_discount500_count')::SMALLINT, gen_vip_holiday_discount500_count),
    child_vip_weekday_discount500_count = COALESCE((p_totals->>'child_vip_weekday_discount500_count')::SMALLINT, child_vip_weekday_discount500_count),
    child_vip_holiday_discount500_count = COALESCE((p_totals->>'child_vip_holiday_discount500_count')::SMALLINT, child_vip_holiday_discount500_count)
  WHERE business_date = p_business_date;

  SELECT * INTO v_after FROM ib_ticket_daily_totals WHERE business_date = p_business_date;

  FOR v_type IN SELECT unnest(enum_range(NULL::ib_ticket_type))
  LOOP
    v_old := CASE v_type
      WHEN 'gen_weekday' THEN v_before.gen_weekday_count
      WHEN 'gen_holiday' THEN v_before.gen_holiday_count
      WHEN 'child_weekday' THEN v_before.child_weekday_count
      WHEN 'child_holiday' THEN v_before.child_holiday_count
      WHEN 'gen_vip_weekday' THEN v_before.gen_vip_weekday_count
      WHEN 'gen_vip_holiday' THEN v_before.gen_vip_holiday_count
      WHEN 'child_vip_weekday' THEN v_before.child_vip_weekday_count
      WHEN 'child_vip_holiday' THEN v_before.child_vip_holiday_count
      WHEN 'vip' THEN v_before.vip_count
      WHEN 'gen_weekday_discount500' THEN v_before.gen_weekday_discount500_count
      WHEN 'gen_holiday_discount500' THEN v_before.gen_holiday_discount500_count
      WHEN 'child_weekday_discount500' THEN v_before.child_weekday_discount500_count
      WHEN 'child_holiday_discount500' THEN v_before.child_holiday_discount500_count
      WHEN 'gen_vip_weekday_discount500' THEN v_before.gen_vip_weekday_discount500_count
      WHEN 'gen_vip_holiday_discount500' THEN v_before.gen_vip_holiday_discount500_count
      WHEN 'child_vip_weekday_discount500' THEN v_before.child_vip_weekday_discount500_count
      WHEN 'child_vip_holiday_discount500' THEN v_before.child_vip_holiday_discount500_count
    END;

    v_new := CASE v_type
      WHEN 'gen_weekday' THEN v_after.gen_weekday_count
      WHEN 'gen_holiday' THEN v_after.gen_holiday_count
      WHEN 'child_weekday' THEN v_after.child_weekday_count
      WHEN 'child_holiday' THEN v_after.child_holiday_count
      WHEN 'gen_vip_weekday' THEN v_after.gen_vip_weekday_count
      WHEN 'gen_vip_holiday' THEN v_after.gen_vip_holiday_count
      WHEN 'child_vip_weekday' THEN v_after.child_vip_weekday_count
      WHEN 'child_vip_holiday' THEN v_after.child_vip_holiday_count
      WHEN 'vip' THEN v_after.vip_count
      WHEN 'gen_weekday_discount500' THEN v_after.gen_weekday_discount500_count
      WHEN 'gen_holiday_discount500' THEN v_after.gen_holiday_discount500_count
      WHEN 'child_weekday_discount500' THEN v_after.child_weekday_discount500_count
      WHEN 'child_holiday_discount500' THEN v_after.child_holiday_discount500_count
      WHEN 'gen_vip_weekday_discount500' THEN v_after.gen_vip_weekday_discount500_count
      WHEN 'gen_vip_holiday_discount500' THEN v_after.gen_vip_holiday_discount500_count
      WHEN 'child_vip_weekday_discount500' THEN v_after.child_vip_weekday_discount500_count
      WHEN 'child_vip_holiday_discount500' THEN v_after.child_vip_holiday_discount500_count
    END;

    v_delta := v_new - v_old;
    IF v_delta <> 0 THEN
      INSERT INTO ib_ticket_entries (business_date, ticket_type, delta_count, entry_mode, operator_id)
      VALUES (p_business_date, v_type, v_delta, 'edit', p_operator_id);
    END IF;
  END LOOP;

  INSERT INTO retail_operation_logs (
    business_date, action, target_type, target_id, snapshot, operator_id
  )
  VALUES (
    p_business_date,
    'ib_ticket_edit',
    'ib_ticket_daily_totals',
    NULL,
    jsonb_build_object('before', row_to_json(v_before), 'after', row_to_json(v_after)),
    p_operator_id
  );

  RETURN v_after;
END;
$$;

-- CREATE OR REPLACE では列の挿入（順序変更）ができないため DROP して再作成
DROP VIEW IF EXISTS retail_daily_report_export;

CREATE VIEW retail_daily_report_export AS
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
  COALESCE(j.jersey_normal_count, 0) AS jersey_normal_count,
  COALESCE(j.jersey_sns_count, 0) AS jersey_sns_count,
  COALESCE(ib.gen_weekday_count, 0) AS ib_gen_weekday_count,
  COALESCE(ib.gen_holiday_count, 0) AS ib_gen_holiday_count,
  COALESCE(ib.child_weekday_count, 0) AS ib_child_weekday_count,
  COALESCE(ib.child_holiday_count, 0) AS ib_child_holiday_count,
  COALESCE(ib.gen_vip_weekday_count, 0) AS ib_gen_vip_weekday_count,
  COALESCE(ib.gen_vip_holiday_count, 0) AS ib_gen_vip_holiday_count,
  COALESCE(ib.child_vip_weekday_count, 0) AS ib_child_vip_weekday_count,
  COALESCE(ib.child_vip_holiday_count, 0) AS ib_child_vip_holiday_count,
  COALESCE(ib.vip_count, 0) AS ib_vip_count,
  COALESCE(ib.gen_weekday_discount500_count, 0) AS ib_gen_weekday_discount500_count,
  COALESCE(ib.gen_holiday_discount500_count, 0) AS ib_gen_holiday_discount500_count,
  COALESCE(ib.child_weekday_discount500_count, 0) AS ib_child_weekday_discount500_count,
  COALESCE(ib.child_holiday_discount500_count, 0) AS ib_child_holiday_discount500_count,
  COALESCE(ib.gen_vip_weekday_discount500_count, 0) AS ib_gen_vip_weekday_discount500_count,
  COALESCE(ib.gen_vip_holiday_discount500_count, 0) AS ib_gen_vip_holiday_discount500_count,
  COALESCE(ib.child_vip_weekday_discount500_count, 0) AS ib_child_vip_weekday_discount500_count,
  COALESCE(ib.child_vip_holiday_discount500_count, 0) AS ib_child_vip_holiday_discount500_count,
  COALESCE(sns.circle_count, 0) AS sns_circle_count,
  COALESCE(sns.square_count, 0) AS sns_square_count
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
        gen_weekday_count = v_before.gen_weekday_count,
        gen_holiday_count = v_before.gen_holiday_count,
        child_weekday_count = v_before.child_weekday_count,
        child_holiday_count = v_before.child_holiday_count,
        gen_vip_weekday_count = v_before.gen_vip_weekday_count,
        gen_vip_holiday_count = v_before.gen_vip_holiday_count,
        child_vip_weekday_count = v_before.child_vip_weekday_count,
        child_vip_holiday_count = v_before.child_vip_holiday_count,
        vip_count = v_before.vip_count,
        gen_weekday_discount500_count = v_before.gen_weekday_discount500_count,
        gen_holiday_discount500_count = v_before.gen_holiday_discount500_count,
        child_weekday_discount500_count = v_before.child_weekday_discount500_count,
        child_holiday_discount500_count = v_before.child_holiday_discount500_count,
        gen_vip_weekday_discount500_count = v_before.gen_vip_weekday_discount500_count,
        gen_vip_holiday_discount500_count = v_before.gen_vip_holiday_discount500_count,
        child_vip_weekday_discount500_count = v_before.child_vip_weekday_discount500_count,
        child_vip_holiday_discount500_count = v_before.child_vip_holiday_discount500_count
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
    v_log.target_type,
    v_log.target_id,
    jsonb_build_object('rolled_back_log_id', p_log_id),
    p_operator_id
  );

  SELECT * INTO v_log FROM retail_operation_logs WHERE id = p_log_id;
  RETURN v_log;
END;
$$;
