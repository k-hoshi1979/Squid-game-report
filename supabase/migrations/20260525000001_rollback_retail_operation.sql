-- ================================================================
-- RETAIL業務: 操作ログの巻き戻し RPC
-- ================================================================

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
      SET quantity = (v_log.snapshot->>'inventory_before')::SMALLINT
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

GRANT EXECUTE ON FUNCTION rollback_retail_operation(UUID, UUID) TO authenticated;
