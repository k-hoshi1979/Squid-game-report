import type { DailyReport } from "@/types/database";
import { parseReportContent } from "@/types/report";
import { TICKET_EXPORT_COLUMNS } from "@/lib/csv/ticketExportColumns";

function escapeCsv(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** 受付名・販売区分の表記ゆれを吸収する */
function normalizeKey(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

function buildLookupMap(
  rows: { receptionName: string; ticketType: string; count: number }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const key = `${normalizeKey(row.receptionName)}||${normalizeKey(row.ticketType)}`;
    map.set(key, (map.get(key) ?? 0) + row.count);
  }
  return map;
}

function lookupCount(
  map: Map<string, number>,
  receptionName: string,
  ticketType: string,
): number {
  const key = `${normalizeKey(receptionName)}||${normalizeKey(ticketType)}`;
  return map.get(key) ?? 0;
}

/** 日報1件分のデータ行（先頭に日付・報告者） */
function buildReportRow(report: DailyReport): (string | number)[] {
  const data = parseReportContent(report.content);
  const lookup = buildLookupMap(data?.csv?.rows ?? []);

  const values = TICKET_EXPORT_COLUMNS.map((col) =>
    lookupCount(lookup, col.receptionName, col.ticketType),
  );

  return [report.report_date, data?.reporter ?? "", ...values];
}

/** チケット項目82列形式のCSV文字列（UTF-8 BOM付き） */
export function buildTicketExportCsv(reports: DailyReport[]): string {
  const headers = [
    "日付",
    "報告者",
    ...TICKET_EXPORT_COLUMNS.map((c) => c.header),
  ];

  const rows = reports.map((r) => buildReportRow(r).map(escapeCsv).join(","));

  return "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows].join("\r\n");
}
