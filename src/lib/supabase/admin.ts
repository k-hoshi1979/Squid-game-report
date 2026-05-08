import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Service Role キーを使う管理者用クライアント。
 * RLS をバイパスするため、サーバーサイド（Server Actions / API Routes）でのみ使用すること。
 * クライアントコンポーネントには絶対に渡さないこと。
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY を .env.local に設定してください"
    );
  }

  return createClient<Database>(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession:   false,
    },
  });
}
