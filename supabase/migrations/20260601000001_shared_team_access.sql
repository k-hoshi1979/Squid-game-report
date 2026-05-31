-- ================================================================
-- チーム共有アクセス: 認証済みユーザーは全データを参照・編集可能
-- 日報は営業日 (report_date) あたり1件
-- ================================================================

-- ----------------------------------------------------------------
-- 1. 同一 report_date の重複日報を整理（最新更新を残す）
-- ----------------------------------------------------------------

DELETE FROM daily_reports
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY report_date
        ORDER BY updated_at DESC, created_at DESC
      ) AS rn
    FROM daily_reports
  ) ranked
  WHERE rn > 1
);

ALTER TABLE daily_reports
  ADD CONSTRAINT daily_reports_report_date_unique UNIQUE (report_date);

-- ----------------------------------------------------------------
-- 2. daily_reports RLS（本人制限を撤廃）
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "daily_reports: 自分の日報を参照可能" ON daily_reports;
DROP POLICY IF EXISTS "daily_reports: 自分の日報を作成可能" ON daily_reports;
DROP POLICY IF EXISTS "daily_reports: 自分の日報を更新可能" ON daily_reports;
DROP POLICY IF EXISTS "daily_reports: 自分の日報を削除可能" ON daily_reports;

CREATE POLICY "daily_reports_select_authenticated" ON daily_reports
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "daily_reports_insert_authenticated" ON daily_reports
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "daily_reports_update_authenticated" ON daily_reports
  FOR UPDATE
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "daily_reports_delete_authenticated" ON daily_reports
  FOR DELETE USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------
-- 3. profiles RLS（全員参照可、更新は本人のみ）
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "profiles: 自分のプロフィールを参照可能" ON profiles;

CREATE POLICY "profiles_select_authenticated" ON profiles
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------
-- 4. messages RLS（更新・削除を全員可）
-- ----------------------------------------------------------------

DROP POLICY IF EXISTS "messages_update_own" ON messages;

CREATE POLICY "messages_update_authenticated" ON messages
  FOR UPDATE
  USING (auth.uid() IS NOT NULL AND deleted_at IS NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ----------------------------------------------------------------
-- 5. report_stats ビュー（店舗全体の集計）
-- ----------------------------------------------------------------

DROP VIEW IF EXISTS report_stats;

CREATE VIEW report_stats AS
SELECT
  NULL::UUID AS user_id,
  COUNT(*) AS total_count,
  COUNT(*) FILTER (WHERE status = 'draft') AS draft_count,
  COUNT(*) FILTER (WHERE status = 'submitted') AS submitted_count,
  COUNT(*) FILTER (WHERE status = 'revised') AS revised_count,
  COUNT(*) FILTER (WHERE status = 'confirmed') AS confirmed_count,
  COUNT(*) FILTER (WHERE report_date >= DATE_TRUNC('month', NOW())::DATE) AS this_month_count,
  MAX(report_date) AS last_report_date
FROM daily_reports;

ALTER VIEW report_stats SET (security_invoker = true);
