-- ================================================================
-- ステータス体系の変更
--   追加: revised（修正済み）, confirmed（確認済み）
--   confirmed_by / confirmed_at 列追加
--   RLS 修正: DELETE の status 制限を撤廃、UPDATE で submitted/revised も可
-- ================================================================

-- 1. ENUM に新しい値を追加
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'revised';
ALTER TYPE report_status ADD VALUE IF NOT EXISTS 'confirmed';

-- 2. 確認者情報の列を追加
ALTER TABLE daily_reports
  ADD COLUMN IF NOT EXISTS confirmed_by  TEXT,
  ADD COLUMN IF NOT EXISTS confirmed_at  TIMESTAMPTZ;

-- 3. 既存の approved → confirmed に移行
UPDATE daily_reports SET status = 'confirmed' WHERE status = 'approved';

-- 4. RLS ポリシーを更新
-- DELETE: status 制限を撤廃（自分の日報なら削除可）
DROP POLICY IF EXISTS "daily_reports: 自分の日報を削除可能" ON daily_reports;
CREATE POLICY "daily_reports: 自分の日報を削除可能"
  ON daily_reports FOR DELETE
  USING (auth.uid() = user_id);

-- UPDATE: draft / submitted / revised を編集可能に変更
DROP POLICY IF EXISTS "daily_reports: 自分の日報を更新可能" ON daily_reports;
CREATE POLICY "daily_reports: 自分の日報を更新可能"
  ON daily_reports FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('draft', 'submitted', 'revised'))
  WITH CHECK (auth.uid() = user_id);

-- 5. report_stats ビューを作り直し
DROP VIEW IF EXISTS report_stats;
CREATE VIEW report_stats AS
SELECT
  user_id,
  COUNT(*)                                                             AS total_count,
  COUNT(*) FILTER (WHERE status = 'draft')                            AS draft_count,
  COUNT(*) FILTER (WHERE status = 'submitted')                        AS submitted_count,
  COUNT(*) FILTER (WHERE status = 'revised')                          AS revised_count,
  COUNT(*) FILTER (WHERE status = 'confirmed')                        AS confirmed_count,
  COUNT(*) FILTER (WHERE report_date >= DATE_TRUNC('month', NOW()))   AS this_month_count,
  MAX(report_date)                                                     AS last_report_date
FROM daily_reports
GROUP BY user_id;

ALTER VIEW report_stats SET (security_invoker = true);
