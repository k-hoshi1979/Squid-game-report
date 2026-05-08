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
    redirect(`/reports/new?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/reports");
  revalidatePath("/dashboard");
  redirect(`/reports/${data.id}`);
}
