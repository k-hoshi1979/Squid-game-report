"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です");

  const fullName  = (formData.get("full_name")  as string | null)?.trim() ?? "";
  const department = (formData.get("department") as string | null)?.trim() ?? "";

  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName || null, department: department || null })
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/settings");
  revalidatePath("/dashboard");
}

export async function updatePassword(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です");

  const newPassword = (formData.get("new_password") as string | null)?.trim() ?? "";
  const confirm     = (formData.get("confirm_password") as string | null)?.trim() ?? "";

  if (!newPassword)              throw new Error("新しいパスワードを入力してください");
  if (newPassword.length < 8)   throw new Error("パスワードは8文字以上にしてください");
  if (newPassword !== confirm)   throw new Error("パスワードが一致しません");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
