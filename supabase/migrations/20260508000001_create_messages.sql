-- ===================================================
-- 申送りメッセージ機能
-- ===================================================

-- updated_at 自動更新関数（存在しない場合のみ作成）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- カテゴリ enum
CREATE TYPE message_category AS ENUM ('confirmation', 'request', 'notice', 'other');

-- 申送りメッセージ本体テーブル
CREATE TABLE messages (
  id          UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category    message_category NOT NULL DEFAULT 'notice',
  content     TEXT             NOT NULL,
  created_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ      -- ソフトデリート（NULLなら有効）
);

-- 操作ログテーブル
-- message_id は意図的にFKなし（メッセージ削除後もログを保持するため）
CREATE TABLE message_logs (
  id                UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id        UUID             NOT NULL,
  user_id           UUID             NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name         TEXT             NOT NULL DEFAULT '',
  action            TEXT             NOT NULL CHECK (action IN ('created', 'edited', 'deleted')),
  content_snapshot  TEXT,
  category_snapshot message_category,
  performed_at      TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);

-- インデックス
CREATE INDEX messages_created_at_idx   ON messages     (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX message_logs_msg_id_idx   ON message_logs (message_id, performed_at);

-- updated_at 自動更新トリガー（既存関数を再利用）
CREATE TRIGGER messages_updated_at
  BEFORE UPDATE ON messages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS 有効化
ALTER TABLE messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_logs ENABLE ROW LEVEL SECURITY;

-- messages：認証済みユーザー全員が閲覧可（削除済み除く）
CREATE POLICY "messages_select" ON messages
  FOR SELECT USING (auth.uid() IS NOT NULL AND deleted_at IS NULL);

-- messages：自分のuser_idのみ挿入可
CREATE POLICY "messages_insert" ON messages
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- messages：自分の投稿のみ更新可（ソフト削除後の行は WITH CHECK で許可）
CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE
  USING (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
    AND deleted_at IS NULL
  )
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = user_id
  );

-- message_logs：認証済みユーザー全員が閲覧可
CREATE POLICY "message_logs_select" ON message_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- message_logs：自分のアクションのみ挿入可
CREATE POLICY "message_logs_insert" ON message_logs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
