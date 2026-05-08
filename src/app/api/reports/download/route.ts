import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseReportContent } from "@/types/report";
import type { DailyReport } from "@/types/database";

// ─── 日付ユーティリティ ───────────────────────────────────

function localDateStr(d: Date) {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function getDateRange(
  period: string,
  baseDate: string,
): { start: string; end: string; label: string } {
  const d = new Date(baseDate + "T00:00:00");

  if (period === "daily") {
    return { start: baseDate, end: baseDate, label: baseDate };
  }

  if (period === "weekly") {
    const dow = d.getDay(); // 0=日
    const monday = new Date(d);
    monday.setDate(d.getDate() - ((dow + 6) % 7));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const start = localDateStr(monday);
    const end   = localDateStr(sunday);
    return { start, end, label: `${start}_${end}` };
  }

  // monthly
  const p2 = (n: number) => String(n).padStart(2, "0");
  const start = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-01`;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const end   = `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(lastDay)}`;
  return { start, end, label: `${d.getFullYear()}${p2(d.getMonth() + 1)}` };
}

// ─── CSV 生成 ─────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  draft:     "下書き",
  submitted: "提出済み",
  revised:   "修正済み",
  confirmed: "確認済み",
};

function escapeCsv(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function generateCsv(reports: DailyReport[]): string {
  const headers = [
    "日付",
    "報告者",
    "ステータス",
    "確認者",
    "確認日時",
    // チケット合計
    "チケット総枚数",
    "チケット総売上（税込）",
    "チケット総売上（税抜）",
    // 特典
    "特典_前日残数",
    "特典_当日残数",
    "特典_当日販売数",
    "特典_売上",
    // 貸切VIP
    "貸切VIP_前日累計",
    "貸切VIP_本日累計",
    "貸切VIP_当日販売数",
    "貸切VIP_売上",
    // リテール
    "リテール売上（税抜）",
    "リテール売上（税込）",
    "決済件数",
    // IB対応チケット
    "IB_一般（平日）枚数",
    "IB_一般（平日）金額",
    "IB_一般（休日）枚数",
    "IB_一般（休日）金額",
    "IB_こども（平日）枚数",
    "IB_こども（平日）金額",
    "IB_こども（休日）枚数",
    "IB_こども（休日）金額",
    "IB_貸切VIP枚数",
    "IB_貸切VIP金額",
    "IB_合計枚数",
    "IB_合計金額",
    // CSV取込
    "CSV_イベント名",
    "CSV_会場",
    "CSV_合計枚数",
    "CSV_合計金額",
    // テキスト
    "運営所感",
    "イレギュラー報告",
  ];

  const rows = reports.map((r) => {
    const d = parseReportContent(r.content);
    const tok = d?.tokuten;
    const vip = d?.kashikiriVip;
    const ret = d?.retail;
    const ib  = d?.ibTickets;
    const csv = d?.csv;
    const tt  = d?.ticketTotal;

    return [
      r.report_date,
      d?.reporter ?? "",
      STATUS_LABELS[r.status] ?? r.status,
      r.confirmed_by ?? "",
      r.confirmed_at ? new Date(r.confirmed_at).toLocaleString("ja-JP") : "",
      // チケット合計
      tt?.count       ?? "",
      tt?.amountTaxIn ?? "",
      tt?.amountTaxEx != null ? Math.round(tt.amountTaxEx) : "",
      // 特典
      tok?.prevRemaining ?? "",
      tok?.todayRemaining ?? "",
      tok?.salesCount    ?? "",
      tok?.amount        ?? "",
      // 貸切VIP
      vip?.prevTotal  ?? "",
      vip?.todayTotal ?? "",
      vip?.salesCount ?? "",
      vip?.amount     ?? "",
      // リテール
      ret?.salesTaxEx    ?? "",
      ret?.salesTaxIn    ?? "",
      ret?.paymentCount  ?? "",
      // IB
      ib?.genWeekday.count   ?? "",
      ib?.genWeekday.amount  ?? "",
      ib?.genHoliday.count   ?? "",
      ib?.genHoliday.amount  ?? "",
      ib?.childWeekday.count  ?? "",
      ib?.childWeekday.amount ?? "",
      ib?.childHoliday.count  ?? "",
      ib?.childHoliday.amount ?? "",
      ib?.vip.count  ?? "",
      ib?.vip.amount ?? "",
      ib?.totalCount  ?? "",
      ib?.totalAmount ?? "",
      // CSV
      csv?.eventName   ?? "",
      csv?.venue        ?? "",
      csv?.totalCount   ?? "",
      csv?.totalAmount  ?? "",
      // テキスト
      d?.operationNotes  ?? "",
      d?.irregularReport ?? "",
    ].map(escapeCsv).join(",");
  });

  // UTF-8 BOM + ヘッダー + データ行
  return "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
}

// ─── Route Handler ────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const period   = searchParams.get("period")   ?? "monthly";
  const baseDate = searchParams.get("date")     ?? localDateStr(new Date());

  const { start, end, label } = getDateRange(period, baseDate);

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: reports, error } = await supabase
      .from("daily_reports")
      .select("*")
      .eq("user_id", user.id)
      .gte("report_date", start)
      .lte("report_date", end)
      .order("report_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const csv      = generateCsv(reports ?? []);
    const filename = `daily-reports-${label}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type":        "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
