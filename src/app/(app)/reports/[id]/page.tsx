import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { ReportStatusBadge } from "@/components/dashboard/ReportStatusBadge";
import { parseReportContent } from "@/types/report";
import type { ReportData } from "@/types/report";
import { DeleteReportButton } from "@/components/reports/DeleteReportButton";
import { ConfirmReportButton } from "@/components/reports/ConfirmReportButton";

interface Props { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("daily_reports").select("title").eq("id", id).single();
  return { title: data?.title ?? "日報詳細" };
}

function fmt(n: number) { return new Intl.NumberFormat("ja-JP").format(Math.round(n)); }

function fmtDate(d: string) {
  try {
    return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric", weekday: "long" }).format(new Date(d + "T00:00:00"));
  } catch { return d; }
}

function fmtDateTime(d: string) {
  return new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(d));
}

// ─── 表示部品 ─────────────────────────────────────────

function Row({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between py-1.5 border-b border-[var(--border)]/60 last:border-0 ${highlight ? "font-semibold" : ""}`}>
      <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
      <div className="text-right">
        <span className={`text-sm ${highlight ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>{value}</span>
        {sub && <span className="ml-2 text-xs text-[var(--muted-foreground)]">{sub}</span>}
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 bg-[var(--muted)] border-b border-[var(--border)]">
        <h2 className="text-sm font-bold text-[var(--foreground)]">{title}</h2>
      </div>
      <div className="px-4 py-2">{children}</div>
    </div>
  );
}

// ─── 構造化レポートのレンダリング ─────────────────────

function StructuredReport({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      {/* ■チケット売上 */}
      <Card title="■ チケット売上">
        {data.csv ? (
          <>
            <p className="text-xs text-[var(--muted-foreground)] pt-1 pb-0.5 font-semibold">{data.csv.eventName}</p>
            <p className="text-xs text-[var(--muted-foreground)] mb-1">{data.csv.venue}</p>
            {/* 受付名グループ別表示 */}
            {(data.csv.groups ?? []).map((group) => (
              <div key={group.receptionName} className="mb-1">
                <p className="text-xs font-bold text-[var(--muted-foreground)] mt-1.5 mb-0.5">▸ {group.receptionName}</p>
                {group.rows.map((row) => (
                  <Row
                    key={row.ticketType}
                    label={`　${row.ticketType}`}
                    value={`${fmt(row.count)}枚`}
                    sub={row.amount > 0 ? `¥${fmt(row.amount)}` : undefined}
                  />
                ))}
                <Row label="　小計" value={`${fmt(group.subtotalCount)}枚`} sub={`¥${fmt(group.subtotalAmount)}`} />
              </div>
            ))}
            {/* groups がない旧データは rows にフォールバック */}
            {(!data.csv.groups || data.csv.groups.length === 0) &&
              data.csv.rows.map((row) => (
                <Row key={row.ticketType} label={row.ticketType} value={`${fmt(row.count)}枚`} sub={`¥${fmt(row.amount)}`} />
              ))
            }
            <Row label="CSV合計" value={`${fmt(data.csv.totalCount)}枚`} sub={`¥${fmt(data.csv.totalAmount)}`} highlight />
          </>
        ) : (
          <p className="text-sm text-[var(--muted-foreground)] py-2">CSVデータなし</p>
        )}

        <div className="mt-1 pt-1 border-t border-[var(--border)]">
          <Row
            label={`特典残数（前日${fmt(data.tokuten.prevRemaining)}→当日${fmt(data.tokuten.todayRemaining)}）`}
            value={`${fmt(data.tokuten.salesCount)}枚`}
            sub={`¥${fmt(data.tokuten.amount)}`}
          />
          <Row
            label={`貸切VIP（前日累計${fmt(data.kashikiriVip.prevTotal)}→本日${fmt(data.kashikiriVip.todayTotal)}）`}
            value={`${fmt(data.kashikiriVip.salesCount)}枚`}
            sub={`¥${fmt(data.kashikiriVip.amount)}`}
          />
        </div>

        <div className="mt-1 pt-1 border-t-2 border-[var(--border)]">
          <Row label="合計枚数" value={`${fmt(data.ticketTotal.count)}枚`} highlight />
          <Row label="売上合計（税込）" value={`¥${fmt(data.ticketTotal.amountTaxIn)}`} highlight />
          <Row label="売上合計（税抜）" value={`¥${fmt(Math.round(data.ticketTotal.amountTaxEx))}`} />
        </div>
      </Card>

      {/* ■リテール売上 */}
      <Card title="■ リテール売上">
        <Row label="物販売り上げ（税抜）" value={`¥${fmt(data.retail.salesTaxEx)}`} />
        <Row label="物販売り上げ（税込）" value={`¥${fmt(Math.round(data.retail.salesTaxIn))}`} highlight />
        <Row label="決済件数" value={`${fmt(data.retail.paymentCount)}件`} />
      </Card>

      {/* ■IB対応チケット */}
      <Card title="■ IB対応チケット">
        {(
          [
            ["一般（平日）",   data.ibTickets.genWeekday],
            ["一般（休日）",   data.ibTickets.genHoliday],
            ["こども（平日）", data.ibTickets.childWeekday],
            ["こども（休日）", data.ibTickets.childHoliday],
            ["貸切VIP",         data.ibTickets.vip],
          ] as [string, { count: number; unitPrice: number; amount: number }][]
        ).map(([label, row]) => (
          <Row
            key={label}
            label={`${label}（×¥${fmt(row.unitPrice)}）`}
            value={`${fmt(row.count)}枚`}
            sub={`¥${fmt(row.amount)}`}
          />
        ))}
        <div className="mt-1 pt-1 border-t border-[var(--border)]">
          <Row label="IB合計" value={`${fmt(data.ibTickets.totalCount)}枚`} sub={`¥${fmt(data.ibTickets.totalAmount)}`} highlight />
        </div>
      </Card>

      {data.operationNotes && (
        <Card title="■ 運営所感">
          <p className="text-sm py-2 whitespace-pre-wrap text-[var(--foreground)]">{data.operationNotes}</p>
        </Card>
      )}
      {data.irregularReport && (
        <Card title="■ イレギュラー報告">
          <p className="text-sm py-2 whitespace-pre-wrap text-[var(--foreground)]">{data.irregularReport}</p>
        </Card>
      )}
    </div>
  );
}

// ─── ページ ───────────────────────────────────────────

export default async function ReportDetailPage({ params }: Props) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: report } = await supabase
    .from("daily_reports")
    .select("*")
    .eq("id", id)
    .eq("user_id", user!.id)
    .single();

  if (!report) notFound();

  const structured = parseReportContent(report.content);
  const canEdit    = report.status !== "confirmed";
  const canConfirm = report.status === "submitted" || report.status === "revised";

  return (
    <>
      <Header
        title={report.title}
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
        <div className="max-w-2xl mx-auto space-y-4">
          {/* メタ情報 */}
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <ReportStatusBadge status={report.status} />
              <span className="text-sm text-[var(--muted-foreground)]">{fmtDate(report.report_date)}</span>
              {structured?.reporter && (
                <span className="text-sm text-[var(--muted-foreground)]">報告者: {structured.reporter}</span>
              )}
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-[var(--muted-foreground)]">
              <span>作成: {fmtDateTime(report.created_at)}</span>
              {report.submitted_at && <span>提出: {fmtDateTime(report.submitted_at)}</span>}
              {report.confirmed_at && report.confirmed_by && (
                <span className="text-green-700 dark:text-green-400 font-medium">
                  確認済み: {report.confirmed_by}（{fmtDateTime(report.confirmed_at)}）
                </span>
              )}
            </div>
          </div>

          {/* レポート本体 */}
          {structured ? (
            <StructuredReport data={structured} />
          ) : (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
              <pre className="text-sm whitespace-pre-wrap font-mono leading-relaxed text-[var(--foreground)]">
                {report.content}
              </pre>
            </div>
          )}

          {/* 確認ボタン（提出済み・修正済みのみ） */}
          {canConfirm && (
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4">
              <p className="text-xs text-[var(--muted-foreground)] mb-3">
                内容を確認したら「確認する」を押してください。確認者名を入力して確定するとステータスが「確認済み」になります。
              </p>
              <ConfirmReportButton reportId={report.id} />
            </div>
          )}

          {/* 操作ボタン */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            {/* 削除ボタン（全ステータスで可） */}
            <DeleteReportButton reportId={report.id} reportTitle={report.title} />

            {/* 編集ボタン（確認済み以外） */}
            {canEdit && (
              <Link
                href={`/reports/${report.id}/edit`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                編集する
              </Link>
            )}
          </div>
        </div>
      </main>
    </>
  );
}
