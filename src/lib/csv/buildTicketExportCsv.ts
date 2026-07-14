import type { DailyReport } from "@/types/database";
import {
  parseReportContent,
  ibTicketsWithDefaults,
  jerseyRentalWithDefaults,
  type ReportData,
} from "@/types/report";
import {
  EXCEL_TICKET_LABELS,
  IB_EXPORT_FIELDS,
  JERSEY_EXPORT_FIELDS,
  RETAIL_EXPORT_FIELDS,
  RETAIL_EXPORT_FIELD_COUNT,
  JERSEY_EXPORT_FIELD_COUNT,
  TICKET_EXPORT_LABELS,
  TICKET_SALES_EXPORT_SECTION,
} from "@/lib/csv/excelExportSpec";
import { mapTicketRowToIndex } from "@/lib/csv/mapTicketRowToIndex";
import { retailMdSalesExcludingIbTickets } from "@/lib/tax";

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

/** 実績管理表 B 列へ貼り付け用（売止末尾→特典→貸切VIP。後者2つは当日販売数） */
function buildTicketExportValues(
  data: ReportData | null,
  csvCounts: number[],
): number[] {
  return [
    ...csvCounts,
    data?.tokuten?.salesCount ?? 0,
    data?.kashikiriVip?.salesCount ?? 0,
  ];
}

function buildAppendValues(data: ReportData | null): number[] {
  const retail = data?.retail;
  const jersey = jerseyRentalWithDefaults(data?.jerseyRental);
  const ib = ibTicketsWithDefaults(data?.ibTickets);

  const salesTaxEx = retail?.salesTaxEx ?? 0;
  const salesTaxIn = retail?.salesTaxIn ?? 0;

  return [
    salesTaxEx,
    salesTaxIn,
    retail?.paymentCount ?? 0,
    retailMdSalesExcludingIbTickets(salesTaxEx, salesTaxIn, ib.totalAmount),
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
    ib.genWeekdayDiscount500.count,
    ib.genHolidayDiscount500.count,
    ib.childWeekdayDiscount500.count,
    ib.childHolidayDiscount500.count,
    ib.genVipWeekdayDiscount500.count,
    ib.genVipHolidayDiscount500.count,
    ib.childVipWeekdayDiscount500.count,
    ib.childVipHolidayDiscount500.count,
    ib.vip.count,
    ib.totalCount,
    ib.totalAmount,
  ];
}

function splitAppendValues(appendValues: number[]) {
  const retailEnd = RETAIL_EXPORT_FIELD_COUNT;
  const jerseyEnd = retailEnd + JERSEY_EXPORT_FIELD_COUNT;
  return {
    retail: appendValues.slice(0, retailEnd),
    jersey: appendValues.slice(retailEnd, jerseyEnd),
    ib: appendValues.slice(jerseyEnd),
  };
}

export interface TicketExportRow {
  date: string;
  reporter: string;
  /** CSV 券種マッピング用（82+売止19） */
  ticketCounts: number[];
  /** 実績管理表 B 列貼り付け用（101券種＋特典・貸切VIP） */
  ticketExportValues: number[];
  appendValues: number[];
}

export function buildTicketExportRow(report: DailyReport): TicketExportRow {
  const data = parseReportContent(report.content);
  const ticketCounts = buildTicketCounts(data?.csv?.rows ?? []);
  return {
    date: report.report_date,
    reporter: data?.reporter ?? "",
    ticketCounts,
    ticketExportValues: buildTicketExportValues(data, ticketCounts),
    appendValues: buildAppendValues(data),
  };
}

function appendSectionLines(
  lines: string[],
  section: string,
  fields: { header: string }[],
  values: number[],
): void {
  lines.push([escapeCsv(section), ""].join(","));
  for (let k = 0; k < fields.length; k++) {
    lines.push(
      [escapeCsv(fields[k].header), escapeCsv(values[k])].join(","),
    );
  }
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

    const { retail, jersey, ib } = splitAppendValues(row.appendValues);

    appendSectionLines(lines, "■リテール売上", RETAIL_EXPORT_FIELDS, retail);
    appendSectionLines(lines, "■ジャージレンタル", JERSEY_EXPORT_FIELDS, jersey);

    lines.push([escapeCsv(TICKET_SALES_EXPORT_SECTION), ""].join(","));
    for (let j = 0; j < TICKET_EXPORT_LABELS.length; j++) {
      lines.push(
        [
          escapeCsv(TICKET_EXPORT_LABELS[j]),
          escapeCsv(row.ticketExportValues[j]),
        ].join(","),
      );
    }

    appendSectionLines(lines, "■IB対応チケット", IB_EXPORT_FIELDS, ib);
  }

  return "\uFEFF" + lines.join("\r\n");
}

/** 横並び（1日1行・月間一括向け） */
function buildHorizontalCsv(rows: TicketExportRow[]): string {
  const headers = [
    "日付",
    "報告者",
    ...RETAIL_EXPORT_FIELDS.map((f) => f.header),
    ...JERSEY_EXPORT_FIELDS.map((f) => f.header),
    ...TICKET_EXPORT_LABELS,
    ...IB_EXPORT_FIELDS.map((f) => f.header),
  ];

  const dataLines = rows.map((row) => {
    const { retail, jersey, ib } = splitAppendValues(row.appendValues);
    return [
      row.date,
      row.reporter,
      ...retail,
      ...jersey,
      ...row.ticketExportValues,
      ...ib,
    ]
      .map(escapeCsv)
      .join(",");
  });

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
