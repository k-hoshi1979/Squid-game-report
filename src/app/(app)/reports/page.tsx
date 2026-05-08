import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { ReportCard } from "@/components/reports/ReportCard";
import { ReportDownloadButton } from "@/components/reports/ReportDownloadButton";
import type { ReportStatus } from "@/types/database";

export const metadata: Metadata = { title: "日報一覧" };

const STATUS_FILTERS: { label: string; value: ReportStatus | "all" }[] = [
  { label: "すべて",   value: "all" },
  { label: "下書き",   value: "draft" },
  { label: "提出済み", value: "submitted" },
  { label: "修正済み", value: "revised" },
  { label: "確認済み", value: "confirmed" },
];

interface ReportsPageProps {
  searchParams: Promise<{ status?: string }>;
}

export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const { status } = await searchParams;
  const activeStatus = (status as ReportStatus | "all") ?? "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let query = supabase
    .from("daily_reports")
    .select("*")
    .eq("user_id", user!.id)
    .order("report_date", { ascending: false });

  if (activeStatus !== "all") {
    query = query.eq("status", activeStatus);
  }

  const { data: reports, error } = await query;

  return (
    <>
      <Header
        title="日報一覧"
        action={
          <Link
            href="/reports/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新規作成
          </Link>
        }
      />

      <main className="flex-1 p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* CSVダウンロード */}
        <ReportDownloadButton />

        {/* ステータスフィルター */}
        <div className="flex items-center gap-2 flex-wrap">
          {STATUS_FILTERS.map((filter) => (
            <Link
              key={filter.value}
              href={filter.value === "all" ? "/reports" : `/reports?status=${filter.value}`}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeStatus === filter.value
                  ? "bg-[var(--primary)] text-white"
                  : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
              }`}
            >
              {filter.label}
            </Link>
          ))}
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-4 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            データの取得に失敗しました: {error.message}
          </div>
        )}

        {/* 日報リスト */}
        {!error && reports && reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-full bg-[var(--muted)] flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-[var(--muted-foreground)] font-medium">
              {activeStatus === "all" ? "日報がまだありません" : `「${STATUS_FILTERS.find(f => f.value === activeStatus)?.label}」の日報はありません`}
            </p>
            {activeStatus === "all" && (
              <Link
                href="/reports/new"
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
              >
                最初の日報を作成する
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {reports?.map((report) => (
              <ReportCard key={report.id} report={report} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
