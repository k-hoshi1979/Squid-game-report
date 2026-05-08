"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function confirmReport(id: string, confirmerName: string) {
  if (!confirmerName.trim()) {
    return { error: "確認者名を入力してください" };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // 確認操作は RLS の UPDATE ポリシーでカバーするため
  // status は submitted / revised のみ対象（confirmed への更新）
  const { error } = await supabase
    .from("daily_reports")
    .update({
      status:       "confirmed",
      confirmed_by: confirmerName.trim(),
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["submitted", "revised"]);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/reports/${id}`);
  revalidatePath("/reports");
  revalidatePath("/dashboard");
  return { success: true };
}
