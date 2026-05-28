import { parseReportContent, snsPostWithDefaults } from "@/types/report";
import { buildTicketExportRow } from "@/lib/csv/buildTicketExportCsv";
import { NUMERIC_ROW_COUNT } from "@/lib/report/itemListSpec";
import type { DailyReport } from "@/types/database";

export interface ItemListTextFields {
  operationNotes: string;
  irregularReport: string;
  lostAndFound: string;
}

/** 日報 content から数値項目（チケット・リテール・ジャージ・IB）を抽出 */
export function extractNumericValuesFromContent(content: string): number[] {
  const data = parseReportContent(content);
  if (!data) return Array(NUMERIC_ROW_COUNT).fill(0);

  const row = buildTicketExportRow({
    content,
    report_date: data.date,
  } as DailyReport);

  return [...row.ticketCounts, ...row.appendValues];
}

/** 日報 content から SNS 投稿枚数を抽出（〇・▢・合計） */
export function extractSnsValuesFromContent(content: string): number[] {
  const data = parseReportContent(content);
  const sns = snsPostWithDefaults(data?.snsPost);
  return [sns.circleCount, sns.squareCount, sns.totalCount];
}

/** 日報 content からテキスト項目を抽出 */
export function extractTextFieldsFromContent(content: string): ItemListTextFields {
  const data = parseReportContent(content);
  return {
    operationNotes: data?.operationNotes?.trim() ?? "",
    irregularReport: data?.irregularReport?.trim() ?? "",
    lostAndFound: data?.lostAndFound?.trim() ?? "",
  };
}

/** 月内の日付 → 数値配列 */
export function buildValuesByDate(
  reports: Pick<DailyReport, "report_date" | "content">[],
): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  for (const r of reports) {
    map[r.report_date] = extractNumericValuesFromContent(r.content);
  }
  return map;
}

/** 月内の日付 → SNS 枚数配列 */
export function buildSnsByDate(
  reports: Pick<DailyReport, "report_date" | "content">[],
): Record<string, number[]> {
  const map: Record<string, number[]> = {};
  for (const r of reports) {
    map[r.report_date] = extractSnsValuesFromContent(r.content);
  }
  return map;
}

/** 月内の日付 → テキスト項目 */
export function buildTextByDate(
  reports: Pick<DailyReport, "report_date" | "content">[],
): Record<string, ItemListTextFields> {
  const map: Record<string, ItemListTextFields> = {};
  for (const r of reports) {
    map[r.report_date] = extractTextFieldsFromContent(r.content);
  }
  return map;
}

export function monthDateRange(yearMonth: string): {
  start: string;
  end: string;
  days: string[];
} {
  const [y, m] = yearMonth.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, "0");
  const days: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    days.push(`${y}-${pad(m)}-${pad(d)}`);
  }
  return {
    start: days[0],
    end: days[days.length - 1],
    days,
  };
}

export function formatDayHeader(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const w = ["日", "月", "火", "水", "木", "金", "土"][d.getDay()];
  return `${d.getMonth() + 1}月${d.getDate()}日（${w}）`;
}

export function currentYearMonth(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
