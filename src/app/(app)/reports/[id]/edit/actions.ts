"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ReportStatus } from "@/types/database";

export async function updateReport(
  id: string,
  currentStatus: ReportStatus,
  formData: FormData
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title       = (formData.get("title") as string).trim();
  const content     = (formData.get("content") as string).trim();
  const report_date = formData.get("report_date") as string;
  const action      = formData.get("action") as string; // "draft" | "submit"

  if (!title || !content || !report_date) {
    redirect(`/reports/${id}/edit?error=${encodeURIComponent("タイトル・内容・日付は必須です")}`);
  }

  // ステータス決定ロジック
  // - draft: action に従いそのまま
  // - submitted/revised の編集後: "submit" → revised, "draft" → draft
  let newStatus: ReportStatus;
  if (currentStatus === "submitted" || currentStatus === "revised") {
    newStatus = action === "submit" ? "revised" : "draft";
  } else {
    newStatus = action === "submit" ? "submitted" : "draft";
  }

  const { error } = await supabase
    .from("daily_reports")
    .update({
      title,
      content,
      report_date,
      status: newStatus,
      submitted_at:
        newStatus === "submitted" || newStatus === "revised"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    redirect(`/reports/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/reports");
  revalidatePath(`/reports/${id}`);
  revalidatePath("/dashboard");
  redirect(`/reports/${id}`);
}

export async function deleteReport(id: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("daily_reports")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect("/reports");
}
