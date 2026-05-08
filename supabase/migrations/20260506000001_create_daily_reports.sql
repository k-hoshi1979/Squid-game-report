-- ================================================================
-- 日報管理ツール: 初期スキーマ
-- ================================================================

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- Enum型定義
-- ================================================================

CREATE TYPE report_status AS ENUM ('draft', 'submitted', 'approved', 'rejected');

-- ================================================================
-- profiles テーブル (auth.usersの拡張)
-- ================================================================

CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  department  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE profiles IS 'auth.usersに紐づくユーザープロフィール情報';

-- ================================================================
-- daily_reports テーブル
-- ================================================================

CREATE TABLE daily_reports (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  content      TEXT NOT NULL,
  status       report_status NOT NULL DEFAULT 'draft',
  report_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  submitted_at TIMESTAMPTZ,
  approved_at  TIMESTAMPTZ,
  approved_by  UUID REFERENCES profiles(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE daily_reports IS '日報データ本体';
COMMENT ON COLUMN daily_reports.status IS 'draft=下書き, submitted=提出済み, approved=承認済み, rejected=差し戻し';

-- ================================================================
-- インデックス
-- ================================================================

CREATE INDEX idx_daily_reports_user_id    ON daily_reports(user_id);
CREATE INDEX idx_daily_reports_report_date ON daily_reports(report_date DESC);
CREATE INDEX idx_daily_reports_status     ON daily_reports(status);
CREATE INDEX idx_daily_reports_user_date  ON daily_reports(user_id, report_date DESC);

-- ================================================================
-- updated_at を自動更新するトリガー関数
-- ================================================================

CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER daily_reports_updated_at
  BEFORE UPDATE ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION handle_updated_at();

-- ================================================================
-- 新規ユーザー登録時に profiles を自動作成するトリガー
-- ================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ================================================================
-- Row Level Security (RLS)
-- ================================================================

ALTER TABLE profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports ENABLE ROW LEVEL SECURITY;

-- profiles ポリシー
CREATE POLICY "profiles: 自分のプロフィールを参照可能"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles: 自分のプロフィールを更新可能"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- daily_reports ポリシー
CREATE POLICY "daily_reports: 自分の日報を参照可能"
  ON daily_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "daily_reports: 自分の日報を作成可能"
  ON daily_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_reports: 自分の日報を更新可能"
  ON daily_reports FOR UPDATE
  USING (auth.uid() = user_id AND status IN ('draft', 'rejected'))
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "daily_reports: 自分の日報を削除可能"
  ON daily_reports FOR DELETE
  USING (auth.uid() = user_id AND status = 'draft');

-- ================================================================
-- ダッシュボード集計用ビュー
-- ================================================================

CREATE VIEW report_stats AS
SELECT
  user_id,
  COUNT(*)                                                    AS total_count,
  COUNT(*) FILTER (WHERE status = 'draft')                    AS draft_count,
  COUNT(*) FILTER (WHERE status = 'submitted')                AS submitted_count,
  COUNT(*) FILTER (WHERE status = 'approved')                 AS approved_count,
  COUNT(*) FILTER (WHERE status = 'rejected')                 AS rejected_count,
  COUNT(*) FILTER (WHERE report_date >= DATE_TRUNC('month', NOW())) AS this_month_count,
  MAX(report_date)                                            AS last_report_date
FROM daily_reports
GROUP BY user_id;

-- ビューのRLS (ユーザーは自分の統計のみ参照可)
ALTER VIEW report_stats SET (security_invoker = true);
