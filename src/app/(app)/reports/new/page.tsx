import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { ReportNewForm } from "@/components/reports/ReportNewForm";
import { createClient } from "@/lib/supabase/server";
import { parseReportContent } from "@/types/report";
import { createReport } from "./actions";

export const metadata: Metadata = { title: "日報作成" };

interface NewReportPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function NewReportPage({ searchParams }: NewReportPageProps) {
  const { error } = await searchParams;

  // 直近の日報から特典・VIPの前日値を取得
  let prevDayValues: { tokutenPrev: number; vipPrev: number; reportDate: string } | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: lastReport } = await supabase
        .from("daily_reports")
        .select("report_date, content")
        .eq("user_id", user.id)
        .order("report_date", { ascending: false })
        .limit(1)
        .single();

      if (lastReport) {
        const data = parseReportContent(lastReport.content);
        if (data) {
          prevDayValues = {
            tokutenPrev: data.tokuten.todayRemaining,
            vipPrev:     data.kashikiriVip.todayTotal,
            reportDate:  lastReport.report_date,
          };
        }
      }
    }
  } catch {
    // 取得失敗時は空のまま（0で初期化）
  }

  return (
    <>
      <Header
        title="日報作成"
        action={
          <Link
            href="/reports"
            className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--border)] text-[var(--foreground)] text-sm font-medium rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            一覧へ戻る
          </Link>
        }
      />
      <main className="flex-1 p-3 sm:p-6">
        <div className="max-w-2xl mx-auto">
          <ReportNewForm action={createReport} error={error} prevDayValues={prevDayValues} />
        </div>
      </main>
    </>
  );
}
