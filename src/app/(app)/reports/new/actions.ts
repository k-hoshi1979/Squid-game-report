"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ReportStatus } from "@/types/database";

export async function createReport(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const title = (formData.get("title") as string).trim();
  const content = (formData.get("content") as string).trim();
  const report_date = formData.get("report_date") as string;
  const action = formData.get("action") as string; // "draft" | "submit"
  const status: ReportStatus = action === "submit" ? "submitted" : "draft";

  if (!title || !content || !report_date) {
    redirect("/reports/new?error=タイトル・内容・日付は必須です");
  }

  const { data: existing } = await supabase
    .from("daily_reports")
    .select("id")
    .eq("report_date", report_date)
    .maybeSingle();

  if (existing) {
    redirect(
      `/reports/${existing.id}/edit?error=${encodeURIComponent("この日付の日報は既にあります。編集画面で更新してください")}`,
    );
  }

  const { data, error } = await supabase
    .from("daily_reports")
    .insert({
      user_id: user.id,
      title,
      content,
      report_date,
      status,
      submitted_at: status === "submitted" ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: dup } = await supabase
        .from("daily_reports")
        .select("id")
        .eq("report_date", report_date)
        .maybeSingle();
      if (dup) {
        redirect(`/reports/${dup.id}/edit`);
      }
    }
    redirect(`/reports/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect(`/reports/${data.id}`);
}
