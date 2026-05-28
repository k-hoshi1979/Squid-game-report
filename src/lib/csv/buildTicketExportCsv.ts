import type { DailyReport } from "@/types/database";
import {
  parseReportContent,
  ibTicketsWithDefaults,
  jerseyRentalWithDefaults,
  type ReportData,
} from "@/types/report";
import {
  APPEND_EXPORT_FIELDS,
  EXCEL_TICKET_LABELS,
} from "@/lib/csv/excelExportSpec";
import { mapTicketRowToIndex } from "@/lib/csv/mapTicketRowToIndex";

export type TicketExportLayout = "vertical" | "horizontal";

function escapeCsv(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function buildTicketCounts(
  rows: { receptionName: string; ticketType: string; count: number }[],
): number[] {
  const counts = Array<number>(EXCEL_TICKET_LABELS.length).fill(0);

  for (const row of rows) {
    const idx = mapTicketRowToIndex(row.receptionName, row.ticketType);
    if (idx >= 0) counts[idx] += row.count;
  }

  return counts;
}

function buildAppendValues(data: ReportData | null): number[] {
  const retail = data?.retail;
  const jersey = jerseyRentalWithDefaults(data?.jerseyRental);
  const ib = ibTicketsWithDefaults(data?.ibTickets);

  return [
    retail?.salesTaxEx ?? 0,
    retail?.salesTaxIn ?? 0,
    retail?.paymentCount ?? 0,
    jersey.normalCount,
    jersey.snsCount,
    jersey.totalAmount,
    ib.genWeekday.count,
    ib.genHoliday.count,
    ib.childWeekday.count,
    ib.childHoliday.count,
    ib.genVipWeekday.count,
    ib.genVipHoliday.count,
    ib.childVipWeekday.count,
    ib.childVipHoliday.count,
    ib.vip.count,
    ib.totalCount,
    ib.totalAmount,
  ];
}

export interface TicketExportRow {
  date: string;
  reporter: string;
  ticketCounts: number[];
  appendValues: number[];
}

export function buildTicketExportRow(report: DailyReport): TicketExportRow {
  const data = parseReportContent(report.content);
  return {
    date: report.report_date,
    reporter: data?.reporter ?? "",
    ticketCounts: buildTicketCounts(data?.csv?.rows ?? []),
    appendValues: buildAppendValues(data),
  };
}

/** 縦並び（Excel へ値列をコピペしやすい形式） */
function buildVerticalCsv(rows: TicketExportRow[]): string {
  const lines: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (i > 0) lines.push("");

    lines.push([escapeCsv("日付"), escapeCsv(row.date)].join(","));
    lines.push([escapeCsv("報告者"), escapeCsv(row.reporter)].join(","));
    lines.push([escapeCsv("項目"), escapeCsv("値")].join(","));

    for (let j = 0; j < EXCEL_TICKET_LABELS.length; j++) {
      lines.push(
        [escapeCsv(EXCEL_TICKET_LABELS[j]), escapeCsv(row.ticketCounts[j])].join(
          ",",
        ),
      );
    }

    let currentSection = "";
    for (let k = 0; k < APPEND_EXPORT_FIELDS.length; k++) {
      const field = APPEND_EXPORT_FIELDS[k];
      if (field.section !== currentSection) {
        currentSection = field.section;
        lines.push([escapeCsv(field.section), ""].join(","));
      }
      lines.push(
        [escapeCsv(field.header), escapeCsv(row.appendValues[k])].join(","),
      );
    }
  }

  return "\uFEFF" + lines.join("\r\n");
}

/** 横並び（1日1行・月間一括向け） */
function buildHorizontalCsv(rows: TicketExportRow[]): string {
  const headers = [
    "日付",
    "報告者",
    ...EXCEL_TICKET_LABELS,
    ...APPEND_EXPORT_FIELDS.map((f) => f.header),
  ];

  const dataLines = rows.map((row) =>
    [
      row.date,
      row.reporter,
      ...row.ticketCounts,
      ...row.appendValues,
    ]
      .map(escapeCsv)
      .join(","),
  );

  return (
    "\uFEFF" +
    [headers.map(escapeCsv).join(","), ...dataLines].join("\r\n")
  );
}

/** 実績管理表向け CSV（UTF-8 BOM付き） */
export function buildTicketExportCsv(
  reports: DailyReport[],
  layout: TicketExportLayout = "vertical",
): string {
  const rows = reports.map(buildTicketExportRow);
  return layout === "horizontal"
    ? buildHorizontalCsv(rows)
    : buildVerticalCsv(rows);
}
