import Link from "next/link";
import type { DailyReport } from "@/types/database";
import { ReportStatusBadge } from "./ReportStatusBadge";

interface RecentReportsProps {
  reports: DailyReport[];
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("ja-JP", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function RecentReports({ reports }: RecentReportsProps) {
  if (reports.length === 0) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-8 shadow-sm">
        <h2 className="text-base font-semibold text-[var(--foreground)] mb-4">
          最近の日報
        </h2>
        <div className="text-center py-8">
          <svg
            className="w-12 h-12 text-[var(--muted-foreground)] mx-auto mb-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <p className="text-sm text-[var(--muted-foreground)]">
            まだ日報がありません
          </p>
          <Link
            href="/reports/new"
            className="inline-flex items-center gap-1.5 mt-3 text-sm text-[var(--primary)] font-medium hover:underline"
          >
            最初の日報を作成する →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          最近の日報
        </h2>
        <Link
          href="/reports"
          className="text-sm text-[var(--primary)] font-medium hover:underline"
        >
          すべて見る
        </Link>
      </div>
      <ul className="divide-y divide-[var(--border)]">
        {reports.map((report) => (
          <li key={report.id}>
            <Link
              href={`/reports/${report.id}`}
              className="flex items-center gap-4 px-5 py-4 hover:bg-[var(--muted)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--foreground)] truncate">
                  {report.title}
                </p>
                <p className="text-xs text-[var(--muted-foreground)] mt-0.5">
                  {formatDate(report.report_date)}
                </p>
              </div>
              <ReportStatusBadge status={report.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
