import {
  ITEM_LIST_NUMERIC_SECTIONS,
  ITEM_LIST_TEXT_SECTIONS,
  ITEM_LIST_NUMERIC_SECTION_IDS,
  ITEM_LIST_TEXT_SECTION_IDS,
  getSectionById,
  sumTicketValuesAcrossDays,
  sumTicketValuesForDate,
  type ItemListExportCategory,
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

function parseSectionIds(
  raw: string | null,
  allowedIds: readonly ItemListSectionId[],
): ItemListSectionId[] {
  const allowed = new Set<ItemListSectionId>(allowedIds);

  if (!raw?.trim()) {
    return [...allowedIds];
  }

  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ItemListSectionId => allowed.has(s as ItemListSectionId));

  return ids.length > 0 ? ids : [...allowedIds];
}

function resolveNumericValue(
  sectionId: ItemListSectionId,
  labelIndex: number,
  date: string | null,
  days: string[],
  valuesByDate: Record<string, number[]>,
  snsByDate: Record<string, number[]>,
): number {
  if (sectionId === "ticket" && labelIndex === 0) {
    return date
      ? sumTicketValuesForDate(valuesByDate[date])
      : sumTicketValuesAcrossDays(days, valuesByDate);
  }

  const section = getSectionById(sectionId);
  const source = sectionId === "sns" ? snsByDate : valuesByDate;
  const valueIndex =
    sectionId === "ticket"
      ? labelIndex - 1
      : sectionId === "sns"
        ? labelIndex
        : section.rowOffset + labelIndex;

  if (date) {
    return source[date]?.[valueIndex] ?? 0;
  }

  return sumAcrossDays(days, source, valueIndex);
}

function buildNumericSectionLines(
  sectionId: ItemListSectionId,
  days: string[],
  valuesByDate: Record<string, number[]>,
  snsByDate: Record<string, number[]>,
): string[] {
  const section = getSectionById(sectionId);
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
    const row = [
      section.labels[labelIndex],
      resolveNumericValue(
        sectionId,
        labelIndex,
        null,
        days,
        valuesByDate,
        snsByDate,
      ),
      ...days.map((date) =>
        formatCellValue(
          resolveNumericValue(
            sectionId,
            labelIndex,
            date,
            days,
            valuesByDate,
            snsByDate,
          ),
        ),
      ),
    ];
    lines.push(row.map(escapeCsv).join(","));
  }

  return lines;
}

function textKeyForSection(
  sectionId: ItemListSectionId,
): keyof ItemListTextFields {
  if (sectionId === "operation") return "operationNotes";
  if (sectionId === "irregular") return "irregularReport";
  return "lostAndFound";
}

/** 数値項目（リテール売上〜SNS投稿）の月次 CSV */
export function buildItemListNumericExportCsv(
  reports: Pick<DailyReport, "report_date" | "content">[],
  yearMonth: string,
  sectionIds: ItemListSectionId[],
): string {
  const { days } = monthDateRange(yearMonth);
  const valuesByDate = buildValuesByDate(reports);
  const snsByDate = buildSnsByDate(reports);

  const orderedSections = ITEM_LIST_NUMERIC_SECTIONS.filter((section) =>
    sectionIds.includes(section.id),
  );

  const blocks = orderedSections.map((section) =>
    buildNumericSectionLines(
      section.id,
      days,
      valuesByDate,
      snsByDate,
    ),
  );

  return "\uFEFF" + blocks.map((lines) => lines.join("\r\n")).join("\r\n\r\n");
}

/** テキスト項目（運営所感・イレギュラー・落とし物）の月次 CSV（日付×項目） */
export function buildItemListTextExportCsv(
  reports: Pick<DailyReport, "report_date" | "content">[],
  yearMonth: string,
  sectionIds: ItemListSectionId[],
): string {
  const { days } = monthDateRange(yearMonth);
  const textByDate = buildTextByDate(reports);

  const orderedSections = ITEM_LIST_TEXT_SECTIONS.filter((section) =>
    sectionIds.includes(section.id),
  );

  const header = [
    "日付",
    ...orderedSections.map((section) => section.tabLabel),
  ];

  const lines = [header.map(escapeCsv).join(",")];

  for (const date of days) {
    const fields = textByDate[date];
    const row = [
      formatDateLabel(date),
      ...orderedSections.map((section) => {
        const textKey = textKeyForSection(section.id);
        return fields?.[textKey] ?? "";
      }),
    ];
    lines.push(row.map(escapeCsv).join(","));
  }

  return "\uFEFF" + lines.join("\r\n");
}

export function parseItemListExportSections(
  raw: string | null,
  category: ItemListExportCategory,
): ItemListSectionId[] {
  const allowedIds =
    category === "numeric"
      ? ITEM_LIST_NUMERIC_SECTION_IDS
      : ITEM_LIST_TEXT_SECTION_IDS;
  return parseSectionIds(raw, allowedIds);
}

export function itemListExportFilename(
  yearMonth: string,
  category: ItemListExportCategory,
): string {
  const [y, m] = yearMonth.split("-");
  const suffix = category === "numeric" ? "数値" : "テキスト";
  return `項目一覧_${suffix}_${y}年${m}月.csv`;
}
