import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { ReportNewForm } from "@/components/reports/ReportNewForm";
import { createClient } from "@/lib/supabase/server";
import { fetchRetailReportPrefill, getBusinessDateString } from "@/lib/retail/prefillReport";
import { parseReportContent } from "@/types/report";
import { createReport } from "./actions";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "日報作成" };

interface NewReportPageProps {
  searchParams: Promise<{ error?: string; date?: string }>;
}

function parseReportDateParam(raw: string | undefined): string | null {
  if (raw && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return null;
}

export default async function NewReportPage({ searchParams }: NewReportPageProps) {
  const { error, date: dateParam } = await searchParams;
  const businessDate = getBusinessDateString();
  const requestedDate = parseReportDateParam(dateParam);
  const targetDate = requestedDate ?? businessDate;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: existingForDate } = await supabase
    .from("daily_reports")
    .select("id")
    .eq("report_date", targetDate)
    .maybeSingle();

  if (existingForDate) {
    redirect(`/reports/${existingForDate.id}/edit`);
  }

  // 直近の日報から特典・VIPの前日値を取得
  let prevDayValues: { tokutenPrev: number; vipPrev: number; reportDate: string } | undefined;
  try {
      const { data: lastReport } = await supabase
        .from("daily_reports")
        .select("report_date, content")
        .order("report_date", { ascending: false })
        .limit(1)
        .maybeSingle();

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
  } catch {
    // 取得失敗時は空のまま（0で初期化）
  }

  const retailPrefill = await fetchRetailReportPrefill(businessDate);

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
          <ReportNewForm
            action={createReport}
            error={error}
            defaultReportDate={requestedDate ?? undefined}
            prevDayValues={prevDayValues}
            retailPrefill={retailPrefill ?? undefined}
          />
        </div>
      </main>
    </>
  );
}
