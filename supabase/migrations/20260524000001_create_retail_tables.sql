-- ================================================================
-- RETAIL業務アプリ: ジャージレンタル + IB臨時チケット
-- ================================================================

-- ----------------------------------------------------------------
-- Enum型
-- ----------------------------------------------------------------

CREATE TYPE jersey_size AS ENUM ('S', 'M', 'L');
CREATE TYPE jersey_rental_type AS ENUM ('normal', 'sns');
CREATE TYPE jersey_rental_status AS ENUM ('rented', 'returned', 'cancelled');

CREATE TYPE ib_ticket_type AS ENUM (
  'gen_weekday',
  'gen_holiday',
  'child_weekday',
  'child_holiday',
  'gen_vip_weekday',
  'gen_vip_holiday',
  'child_vip_weekday',
  'child_vip_holiday',
  'vip'
);

CREATE TYPE ib_entry_mode AS ENUM ('add', 'edit');

CREATE TYPE retail_log_action AS ENUM (
  'jersey_rent',
  'jersey_return',
  'jersey_inventory_update',
  'ib_ticket_add',
  'ib_ticket_edit',
  'rollback'
);

-- ----------------------------------------------------------------
-- マスタ: ジャージグループ / 個体 / 在庫
-- ----------------------------------------------------------------

CREATE TABLE jersey_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        TEXT        NOT NULL UNIQUE CHECK (code IN ('A', 'B', 'C')),
  sort_order  SMALLINT    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE jersey_groups IS 'ジャージグループ（A/B/C 固定）';

CREATE TABLE jersey_items (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID        NOT NULL REFERENCES jersey_groups(id) ON DELETE RESTRICT,
  label       TEXT        NOT NULL CHECK (label ~ '^\d{3}$'),
  sort_order  SMALLINT    NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, label)
);

COMMENT ON TABLE jersey_items IS 'ジャージ番号マスタ（456, 001 等）';

CREATE TABLE jersey_inventory (
  jersey_item_id  UUID        NOT NULL REFERENCES jersey_items(id) ON DELETE RESTRICT,
  size            jersey_size NOT NULL,
  quantity        SMALLINT    NOT NULL DEFAULT 0 CHECK (quantity >= 0),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (jersey_item_id, size)
);

COMMENT ON TABLE jersey_inventory IS 'ジャージ在庫（グループ×番号×サイズ）';

CREATE TRIGGER jersey_inventory_updated_at
  BEFORE UPDATE ON jersey_inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------
-- ジャージ貸出
-- ----------------------------------------------------------------

CREATE TABLE jersey_rentals (
  id               UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number     TEXT                  NOT NULL UNIQUE,
  business_date    DATE                  NOT NULL,
  jersey_item_id   UUID                  NOT NULL REFERENCES jersey_items(id) ON DELETE RESTRICT,
  size             jersey_size           NOT NULL,
  rental_type      jersey_rental_type    NOT NULL,
  session_start_at TIMESTAMPTZ           NOT NULL,
  rented_at        TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  returned_at      TIMESTAMPTZ,
  status           jersey_rental_status  NOT NULL DEFAULT 'rented',
  operator_id      UUID                  NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE jersey_rentals IS 'ジャージ貸出トランザクション';

CREATE INDEX idx_jersey_rentals_business_date ON jersey_rentals (business_date DESC);
CREATE INDEX idx_jersey_rentals_status        ON jersey_rentals (status) WHERE status = 'rented';
CREATE INDEX idx_jersey_rentals_item          ON jersey_rentals (jersey_item_id, size);

CREATE TRIGGER jersey_rentals_updated_at
  BEFORE UPDATE ON jersey_rentals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ----------------------------------------------------------------
-- IB臨時チケット 日次集計
-- ----------------------------------------------------------------

CREATE TABLE ib_ticket_daily_totals (
  business_date          DATE        PRIMARY KEY,
  gen_weekday_count      SMALLINT    NOT NULL DEFAULT 0 CHECK (gen_weekday_count >= 0),
  gen_holiday_count      SMALLINT    NOT NULL DEFAULT 0 CHECK (gen_holiday_count >= 0),
  child_weekday_count    SMALLINT    NOT NULL DEFAULT 0 CHECK (child_weekday_count >= 0),
  child_holiday_count    SMALLINT    NOT NULL DEFAULT 0 CHECK (child_holiday_count >= 0),
  gen_vip_weekday_count  SMALLINT    NOT NULL DEFAULT 0 CHECK (gen_vip_weekday_count >= 0),
  gen_vip_holiday_count  SMALLINT    NOT NULL DEFAULT 0 CHECK (gen_vip_holiday_count >= 0),
  child_vip_weekday_count SMALLINT   NOT NULL DEFAULT 0 CHECK (child_vip_weekday_count >= 0),
  child_vip_holiday_count SMALLINT   NOT NULL DEFAULT 0 CHECK (child_vip_holiday_count >= 0),
  vip_count              SMALLINT    NOT NULL DEFAULT 0 CHECK (vip_count >= 0),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ib_ticket_daily_totals IS 'IB臨時チケットの日次合計枚数';

CREATE TRIGGER ib_ticket_daily_totals_updated_at
  BEFORE UPDATE ON ib_ticket_daily_totals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE ib_ticket_entries (
  id             UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date  DATE           NOT NULL,
  ticket_type    ib_ticket_type NOT NULL,
  delta_count    SMALLINT       NOT NULL,
  entry_mode     ib_entry_mode  NOT NULL,
  operator_id    UUID           NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  created_at     TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE ib_ticket_entries IS 'IBチケット購入の増減履歴';

CREATE INDEX idx_ib_ticket_entries_business_date ON ib_ticket_entries (business_date DESC);

-- ----------------------------------------------------------------
-- 操作ログ（巻き戻し用スナップショット付き）
-- ----------------------------------------------------------------

CREATE TABLE retail_operation_logs (
  id             UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  business_date  DATE              NOT NULL,
  action         retail_log_action NOT NULL,
  target_type    TEXT              NOT NULL,
  target_id      UUID,
  snapshot       JSONB             NOT NULL DEFAULT '{}',
  operator_id    UUID              NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  performed_at   TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  rolled_back_at TIMESTAMPTZ,
  rolled_back_by UUID REFERENCES profiles(id)
);

COMMENT ON TABLE retail_operation_logs IS 'RETAIL業務の操作ログ';

CREATE INDEX idx_retail_operation_logs_business_date ON retail_operation_logs (business_date DESC, performed_at DESC);
CREATE INDEX idx_retail_operation_logs_active        ON retail_operation_logs (performed_at DESC) WHERE rolled_back_at IS NULL;

-- ----------------------------------------------------------------
-- ヘルパー: 営業日（JST 0時切り替え）
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION retail_business_date(p_at TIMESTAMPTZ DEFAULT NOW())
RETURNS DATE
LANGUAGE sql STABLE
AS $$
  SELECT (timezone('Asia/Tokyo', p_at))::DATE;
$$;

-- ----------------------------------------------------------------
-- IB日次集計行の取得 or 作成
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION ensure_ib_ticket_daily_totals(p_business_date DATE)
RETURNS ib_ticket_daily_totals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row ib_ticket_daily_totals;
BEGIN
  INSERT INTO ib_ticket_daily_totals (business_date)
  VALUES (p_business_date)
  ON CONFLICT (business_date) DO NOTHING;

  SELECT * INTO v_row
  FROM ib_ticket_daily_totals
  WHERE business_date = p_business_date;

  RETURN v_row;
END;
$$;

-- ----------------------------------------------------------------
-- ジャージ貸出 RPC（在庫 > 0 のみ）
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
  SET quantity = quantity - 1
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
-- ジャージ返却 RPC
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION return_jersey(
  p_rental_id   UUID,
  p_operator_id UUID
)
RETURNS jersey_rentals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rental     jersey_rentals;
  v_qty_before SMALLINT;
  v_group_code TEXT;
  v_item_label TEXT;
BEGIN
  IF p_operator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'operator mismatch';
  END IF;

  SELECT * INTO v_rental
  FROM jersey_rentals
  WHERE id = p_rental_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rental not found';
  END IF;

  IF v_rental.status <> 'rented' THEN
    RAISE EXCEPTION 'rental is not active';
  END IF;

  SELECT quantity INTO v_qty_before
  FROM jersey_inventory
  WHERE jersey_item_id = v_rental.jersey_item_id AND size = v_rental.size
  FOR UPDATE;

  UPDATE jersey_inventory
  SET quantity = quantity + 1
  WHERE jersey_item_id = v_rental.jersey_item_id AND size = v_rental.size;

  UPDATE jersey_rentals
  SET status = 'returned', returned_at = NOW()
  WHERE id = p_rental_id
  RETURNING * INTO v_rental;

  SELECT jg.code, ji.label
  INTO v_group_code, v_item_label
  FROM jersey_items ji
  JOIN jersey_groups jg ON jg.id = ji.group_id
  WHERE ji.id = v_rental.jersey_item_id;

  INSERT INTO retail_operation_logs (
    business_date, action, target_type, target_id, snapshot, operator_id
  )
  VALUES (
    v_rental.business_date,
    'jersey_return',
    'jersey_rentals',
    v_rental.id,
    jsonb_build_object(
      'rental', row_to_json(v_rental),
      'group_code', v_group_code,
      'item_label', v_item_label,
      'inventory_before', v_qty_before,
      'inventory_after', v_qty_before + 1
    ),
    p_operator_id
  );

  RETURN v_rental;
END;
$$;

-- ----------------------------------------------------------------
-- ジャージ在庫一括更新 RPC
-- ----------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_jersey_inventory(
  p_updates     JSONB,
  p_operator_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item          JSONB;
  v_item_id       UUID;
  v_size          jersey_size;
  v_quantity      SMALLINT;
  v_before        SMALLINT;
  v_business_date DATE := retail_business_date(NOW());
  v_changes       JSONB := '[]'::JSONB;
BEGIN
  IF p_operator_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'operator mismatch';
  END IF;

  IF jsonb_typeof(p_updates) <> 'array' THEN
    RAISE EXCEPTION 'updates must be a JSON array';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_updates)
  LOOP
    v_item_id  := (v_item->>'jersey_item_id')::UUID;
    v_size     := (v_item->>'size')::jersey_size;
    v_quantity := (v_item->>'quantity')::SMALLINT;

    IF v_quantity < 0 THEN
      RAISE EXCEPTION 'quantity must be >= 0';
    END IF;

    SELECT quantity INTO v_before
    FROM jersey_inventory
    WHERE jersey_item_id = v_item_id AND size = v_size
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'inventory not found';
    END IF;

    IF v_before IS DISTINCT FROM v_quantity THEN
      UPDATE jersey_inventory
      SET quantity = v_quantity
      WHERE jersey_item_id = v_item_id AND size = v_size;

      v_changes := v_changes || jsonb_build_array(jsonb_build_object(
        'jersey_item_id', v_item_id,
        'size', v_size,
        'before', v_before,
        'after', v_quantity
      ));
    END IF;
  END LOOP;

  IF jsonb_array_length(v_changes) > 0 THEN
    INSERT INTO retail_operation_logs (
      business_date, action, target_type, target_id, snapshot, operator_id
    )
    VALUES (
      v_business_date,
      'jersey_inventory_update',
      'jersey_inventory',
      NULL,
      jsonb_build_object('changes', v_changes),
      p_operator_id
    );
  END IF;
END;
$$;

-- ----------------------------------------------------------------
-- IBチケット追加 RPC（差分加算）
-- ----------------------------------------------------------------

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
      vip_count = vip_count + CASE WHEN v_type = 'vip' THEN v_delta ELSE 0 END
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

-- ----------------------------------------------------------------
-- IBチケット修正 RPC（合計値を直接設定）
-- ----------------------------------------------------------------

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
    vip_count = COALESCE((p_totals->>'vip_count')::SMALLINT, vip_count)
  WHERE business_date = p_business_date;

  SELECT * INTO v_after FROM ib_ticket_daily_totals WHERE business_date = p_business_date;

  -- 変更があった券種のみエントリ記録
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

-- ----------------------------------------------------------------
-- 日報連携用ビュー
-- ----------------------------------------------------------------

CREATE VIEW retail_daily_report_export AS
SELECT
  COALESCE(j.business_date, ib.business_date) AS business_date,
  COALESCE(j.jersey_normal_count, 0)          AS jersey_normal_count,
  COALESCE(j.jersey_sns_count, 0)               AS jersey_sns_count,
  COALESCE(ib.gen_weekday_count, 0)             AS ib_gen_weekday_count,
  COALESCE(ib.gen_holiday_count, 0)             AS ib_gen_holiday_count,
  COALESCE(ib.child_weekday_count, 0)           AS ib_child_weekday_count,
  COALESCE(ib.child_holiday_count, 0)           AS ib_child_holiday_count,
  COALESCE(ib.gen_vip_weekday_count, 0)         AS ib_gen_vip_weekday_count,
  COALESCE(ib.gen_vip_holiday_count, 0)         AS ib_gen_vip_holiday_count,
  COALESCE(ib.child_vip_weekday_count, 0)       AS ib_child_vip_weekday_count,
  COALESCE(ib.child_vip_holiday_count, 0)       AS ib_child_vip_holiday_count,
  COALESCE(ib.vip_count, 0)                     AS ib_vip_count
FROM (
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
) j
FULL OUTER JOIN ib_ticket_daily_totals ib
  ON j.business_date = ib.business_date;

ALTER VIEW retail_daily_report_export SET (security_invoker = true);

-- ----------------------------------------------------------------
-- 初期マスタ seed
-- ----------------------------------------------------------------

INSERT INTO jersey_groups (code, sort_order) VALUES
  ('A', 1),
  ('B', 2),
  ('C', 3);

INSERT INTO jersey_items (group_id, label, sort_order)
SELECT g.id, v.label, v.sort_order
FROM jersey_groups g
JOIN (
  VALUES
    ('456', 1),
    ('001', 2),
    ('120', 3),
    ('333', 4)
) AS v(label, sort_order) ON TRUE
WHERE g.code IN ('A', 'B', 'C');

INSERT INTO jersey_inventory (jersey_item_id, size, quantity)
SELECT ji.id, v.size::jersey_size, v.qty
FROM jersey_items ji
JOIN jersey_groups jg ON jg.id = ji.group_id
JOIN (
  VALUES
    ('A', '456', 'S', 1), ('A', '456', 'M', 1), ('A', '456', 'L', 1),
    ('A', '001', 'S', 1), ('A', '001', 'M', 1), ('A', '001', 'L', 1),
    ('A', '120', 'S', 0), ('A', '120', 'M', 1), ('A', '120', 'L', 1),
    ('A', '333', 'S', 0), ('A', '333', 'M', 1), ('A', '333', 'L', 1),
    ('B', '456', 'S', 1), ('B', '456', 'M', 1), ('B', '456', 'L', 1),
    ('B', '001', 'S', 0), ('B', '001', 'M', 1), ('B', '001', 'L', 1),
    ('B', '120', 'S', 1), ('B', '120', 'M', 1), ('B', '120', 'L', 1),
    ('B', '333', 'S', 0), ('B', '333', 'M', 1), ('B', '333', 'L', 1),
    ('C', '456', 'S', 1), ('C', '456', 'M', 1), ('C', '456', 'L', 1),
    ('C', '001', 'S', 0), ('C', '001', 'M', 1), ('C', '001', 'L', 1),
    ('C', '120', 'S', 0), ('C', '120', 'M', 1), ('C', '120', 'L', 1),
    ('C', '333', 'S', 1), ('C', '333', 'M', 1), ('C', '333', 'L', 1)
) AS v(group_code, label, size, qty)
  ON jg.code = v.group_code AND ji.label = v.label;

-- ----------------------------------------------------------------
-- Row Level Security
-- ----------------------------------------------------------------

ALTER TABLE jersey_groups          ENABLE ROW LEVEL SECURITY;
ALTER TABLE jersey_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE jersey_inventory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE jersey_rentals         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ib_ticket_daily_totals ENABLE ROW LEVEL SECURITY;
ALTER TABLE ib_ticket_entries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE retail_operation_logs  ENABLE ROW LEVEL SECURITY;

-- 認証済みユーザー全員が参照可能
CREATE POLICY "retail_select_jersey_groups" ON jersey_groups
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "retail_select_jersey_items" ON jersey_items
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "retail_select_jersey_inventory" ON jersey_inventory
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "retail_select_jersey_rentals" ON jersey_rentals
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "retail_select_ib_ticket_daily_totals" ON ib_ticket_daily_totals
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "retail_select_ib_ticket_entries" ON ib_ticket_entries
  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "retail_select_retail_operation_logs" ON retail_operation_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- 在庫更新（RPC経由が主だが直接UPDATEも許可）
CREATE POLICY "retail_update_jersey_inventory" ON jersey_inventory
  FOR UPDATE USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- RPC関数の実行権限
GRANT EXECUTE ON FUNCTION retail_business_date(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_ib_ticket_daily_totals(DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION rent_jersey(UUID, jersey_size, jersey_rental_type, TIMESTAMPTZ, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION return_jersey(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION update_jersey_inventory(JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION add_ib_tickets(DATE, JSONB, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION edit_ib_tickets(DATE, JSONB, UUID) TO authenticated;
