import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { ReportNewForm } from "@/components/reports/ReportNewForm";
import { parseReportContent, sanitizeReportForForm } from "@/types/report";
import type { ReportStatus } from "@/types/database";
import { updateReport } from "./actions";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}

export const metadata: Metadata = { title: "日報を編集" };

export default async function ReportEditPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: report } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!report) notFound();

  // 確認済みは編集不可
  if (report.status === "confirmed") {
    redirect(`/reports/${id}`);
  }

  const reportStatus = report.status;

  const structured = parseReportContent(report.content);
  const editInitialData = structured ? sanitizeReportForForm(structured) : undefined;

  async function submitEditedReport(formData: FormData) {
    "use server";
    await updateReport(id, reportStatus as ReportStatus, formData);
  }

  return (
    <>
      <Header
        title="日報を編集"
        action={
          <Link
            href={`/reports/${id}`}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--border)] text-[var(--foreground)] text-sm font-medium rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            詳細に戻る
          </Link>
        }
      />
      <main className="flex-1 p-3 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <ReportNewForm
            action={submitEditedReport}
            error={error ? decodeURIComponent(error) : undefined}
            initialData={editInitialData}
            isEdit
          />
        </div>
      </main>
    </>
  );
}
