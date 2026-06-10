import type { CsvTicketRow, ReportData } from "@/types/report";
import {
  isInnerReception,
  isUridomeReception,
} from "@/lib/csv/ticketCsvMapping";
import { taxExFromTaxIn } from "@/lib/tax";

export interface MallProPurchaseRow {
  count: number;
  amount: number;
}

export interface MallProExportData {
  reportDate: string;
  reportDateLabel: string;
  ticketPurchase: MallProPurchaseRow;
  tokutenPurchase: MallProPurchaseRow;
  vipPurchase: MallProPurchaseRow;
  totalTaxEx: number;
}

export function fmtYen(n: number): string {
  return new Intl.NumberFormat("ja-JP").format(Math.round(n));
}

export function fmtCount(n: number): string {
  return new Intl.NumberFormat("ja-JP").format(Math.round(n));
}

export function formatReportDateJa(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  const label = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
  return `${label}（${w}）`;
}

/** モールプロ添付のチケット集計から除外する行か */
export function isExcludedFromMallProTicket(row: CsvTicketRow): boolean {
  // インナー受付（E列）
  if (isInnerReception(row.receptionName)) return true;
  // 売止貸切（売止用受付の貸切系券種）
  if (isUridomeReception(row.receptionName) && row.ticketType.includes("貸切")) {
    return true;
  }
  // 単価0円の券種すべて
  if (row.unitPrice <= 0) return true;
  return false;
}

/**
 * CSV チケット行からモールプロ報告対象の枚数・税込売上を集計
 * （インナー受付・売止貸切・単価0円の行を除外）
 */
export function sumCsvTicketsForMallPro(
  rows: CsvTicketRow[] | undefined,
): { count: number; amountTaxIn: number } {
  if (!rows?.length) return { count: 0, amountTaxIn: 0 };

  let count = 0;
  let amountTaxIn = 0;
  for (const row of rows) {
    if (isExcludedFromMallProTicket(row)) continue;
    count += row.count;
    amountTaxIn += row.amount;
  }
  return { count, amountTaxIn };
}

/** 日報データからモールプロ添付用の数値を抽出 */
export function buildMallProData(
  reportDate: string,
  data: ReportData,
): MallProExportData {
  const csvRows = data.csv?.rows;
  const ticket =
    csvRows && csvRows.length > 0
      ? (() => {
          const { count, amountTaxIn } = sumCsvTicketsForMallPro(csvRows);
          return { count, amount: taxExFromTaxIn(amountTaxIn) };
        })()
      : {
          count: data.csv?.totalCount ?? 0,
          amount: taxExFromTaxIn(data.csv?.totalAmount ?? 0),
        };

  const tokutenTaxEx = taxExFromTaxIn(data.tokuten?.amount ?? 0);
  const vipTaxEx = taxExFromTaxIn(data.kashikiriVip?.amount ?? 0);

  return {
    reportDate,
    reportDateLabel: formatReportDateJa(reportDate),
    ticketPurchase: ticket,
    tokutenPurchase: {
      count: data.tokuten?.salesCount ?? 0,
      amount: tokutenTaxEx,
    },
    vipPurchase: {
      count: data.kashikiriVip?.salesCount ?? 0,
      amount: vipTaxEx,
    },
    totalTaxEx: ticket.amount + tokutenTaxEx + vipTaxEx,
  };
}
