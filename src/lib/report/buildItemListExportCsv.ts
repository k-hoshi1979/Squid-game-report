import {
  ITEM_LIST_SECTIONS,
  getSectionById,
  type ItemListSectionId,
} from "@/lib/report/itemListSpec";
import {
  buildSnsByDate,
  buildTextByDate,
  buildValuesByDate,
  formatDateLabel,
  formatDayHeader,
  monthDateRange,
  type ItemListTextFields,
} from "@/lib/report/extractItemValues";
import type { DailyReport } from "@/types/database";

function escapeCsv(v: string | number | null | undefined): string {
  const s = String(v ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function sumAcrossDays(
  days: string[],
  valuesByDate: Record<string, number[]>,
  valueIndex: number,
): number {
  let sum = 0;
  for (const date of days) {
    const value = valuesByDate[date]?.[valueIndex];
    if (value !== undefined) sum += value;
  }
  return sum;
}

function formatCellValue(value: number | undefined): string {
  if (value === undefined) return "";
  return String(value);
}

function parseSectionIds(raw: string | null): ItemListSectionId[] {
  if (!raw?.trim()) {
    return ITEM_LIST_SECTIONS.map((s) => s.id);
  }

  const allowed = new Set<ItemListSectionId>(
    ITEM_LIST_SECTIONS.map((s) => s.id),
  );
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ItemListSectionId => allowed.has(s as ItemListSectionId));

  return ids.length > 0 ? ids : ITEM_LIST_SECTIONS.map((s) => s.id);
}

function textKeyForSection(
  sectionId: ItemListSectionId,
): keyof ItemListTextFields {
  if (sectionId === "operation") return "operationNotes";
  if (sectionId === "irregular") return "irregularReport";
  return "lostAndFound";
}

function buildNumericSectionLines(
  sectionId: ItemListSectionId,
  days: string[],
  valuesByDate: Record<string, number[]>,
  snsByDate: Record<string, number[]>,
): string[] {
  const section = getSectionById(sectionId);
  const source = sectionId === "sns" ? snsByDate : valuesByDate;
  const header = [
    "項目",
    "月間合計",
    ...days.map((date) => formatDayHeader(date)),
  ];

  const lines = [
    escapeCsv(section.tabLabel),
    header.map(escapeCsv).join(","),
  ];

  for (let labelIndex = 0; labelIndex < section.labels.length; labelIndex++) {
    const valueIndex =
      sectionId === "sns" ? labelIndex : section.rowOffset + labelIndex;
    const row = [
      section.labels[labelIndex],
      sumAcrossDays(days, source, valueIndex),
      ...days.map((date) => formatCellValue(source[date]?.[valueIndex])),
    ];
    lines.push(row.map(escapeCsv).join(","));
  }

  return lines;
}

function buildTextSectionLines(
  sectionId: ItemListSectionId,
  days: string[],
  textByDate: Record<string, ItemListTextFields>,
): string[] {
  const section = getSectionById(sectionId);
  const textKey = textKeyForSection(sectionId);
  const lines = [
    escapeCsv(section.tabLabel),
    [escapeCsv("日付"), escapeCsv("内容")].join(","),
  ];

  for (const date of days) {
    const fields = textByDate[date];
    const text = fields?.[textKey] ?? "";
    lines.push(
      [escapeCsv(formatDateLabel(date)), escapeCsv(text)].join(","),
    );
  }

  return lines;
}

/** 項目一覧の表示順どおりに、選択セクションの月次 CSV を生成する */
export function buildItemListExportCsv(
  reports: Pick<DailyReport, "report_date" | "content">[],
  yearMonth: string,
  sectionIds: ItemListSectionId[],
): string {
  const { days } = monthDateRange(yearMonth);
  const valuesByDate = buildValuesByDate(reports);
  const snsByDate = buildSnsByDate(reports);
  const textByDate = buildTextByDate(reports);

  const orderedSections = ITEM_LIST_SECTIONS.filter((section) =>
    sectionIds.includes(section.id),
  );

  const blocks: string[][] = [];

  for (const section of orderedSections) {
    if (section.kind === "numeric") {
      blocks.push(
        buildNumericSectionLines(
          section.id,
          days,
          valuesByDate,
          snsByDate,
        ),
      );
    } else {
      blocks.push(buildTextSectionLines(section.id, days, textByDate));
    }
  }

  return "\uFEFF" + blocks.map((lines) => lines.join("\r\n")).join("\r\n\r\n");
}

export function parseItemListExportSections(
  raw: string | null,
): ItemListSectionId[] {
  return parseSectionIds(raw);
}

export function itemListExportFilename(yearMonth: string): string {
  const [y, m] = yearMonth.split("-");
  return `項目一覧_${y}年${m}月.csv`;
}
