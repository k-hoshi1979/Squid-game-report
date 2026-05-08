"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function inviteMember(formData: FormData) {
  // 自分がログイン済みか確認
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です");

  const email = (formData.get("email") as string | null)?.trim() ?? "";
  if (!email || !email.includes("@")) throw new Error("有効なメールアドレスを入力してください");

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email);

  if (error) {
    if (error.message.includes("already been registered")) {
      throw new Error("このメールアドレスはすでに登録されています");
    }
    throw new Error(error.message);
  }
}
