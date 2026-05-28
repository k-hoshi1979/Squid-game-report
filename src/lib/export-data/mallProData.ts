import type { ReportData } from "@/types/report";
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

/** 日報データからモールプロ添付用の数値を抽出 */
export function buildMallProData(
  reportDate: string,
  data: ReportData,
): MallProExportData {
  const ticketTaxEx = taxExFromTaxIn(data.csv?.totalAmount ?? 0);
  const tokutenTaxEx = taxExFromTaxIn(data.tokuten?.amount ?? 0);
  const vipTaxEx = taxExFromTaxIn(data.kashikiriVip?.amount ?? 0);

  return {
    reportDate,
    reportDateLabel: formatReportDateJa(reportDate),
    ticketPurchase: {
      count: data.csv?.totalCount ?? 0,
      amount: ticketTaxEx,
    },
    tokutenPurchase: {
      count: data.tokuten?.salesCount ?? 0,
      amount: tokutenTaxEx,
    },
    vipPurchase: {
      count: data.kashikiriVip?.salesCount ?? 0,
      amount: vipTaxEx,
    },
    totalTaxEx: ticketTaxEx + tokutenTaxEx + vipTaxEx,
  };
}
