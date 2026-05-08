import Link from "next/link";
import type { DailyReport } from "@/types/database";
import { ReportStatusBadge } from "@/components/dashboard/ReportStatusBadge";

interface ReportCardProps {
  report: DailyReport;
}

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(dateStr));
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffMin < 1) return "たった今";
  if (diffMin < 60) return `${diffMin}分前`;
  if (diffHour < 24) return `${diffHour}時間前`;
  if (diffDay < 7) return `${diffDay}日前`;
  return formatDate(dateStr);
}

export function ReportCard({ report }: ReportCardProps) {
  const preview = report.content.replace(/\s+/g, " ").trim().slice(0, 80);

  return (
    <Link
      href={`/reports/${report.id}`}
      className="block bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 transition-all group"
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-[var(--foreground)] group-hover:text-[var(--primary)] transition-colors line-clamp-1">
          {report.title}
        </h3>
        <ReportStatusBadge status={report.status} />
      </div>

      {preview && (
        <p className="text-sm text-[var(--muted-foreground)] line-clamp-2 mb-3">
          {preview}
          {report.content.length > 80 && "…"}
        </p>
      )}

      <div className="flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatDate(report.report_date)}
        </span>
        <span className="text-[var(--border)]">·</span>
        <span>{formatRelativeTime(report.updated_at)}</span>
      </div>
    </Link>
  );
}
