-- ソフト削除 UPDATE 時に「new row violates row-level security policy for table messages」が
-- 起きないよう、UPDATE の WITH CHECK を明示する。
-- （既存 DB では Supabase SQL Editor で本ファイルを実行してください）

DROP POLICY IF EXISTS "messages_update_own" ON messages;

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
