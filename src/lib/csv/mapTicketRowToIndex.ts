import { EXCEL_TICKET_LABELS } from "@/lib/csv/excelExportSpec";
import { normalizeTicketLabel } from "@/lib/csv/normalizeTicketLabel";
import {
  categoryFromReceptionName,
  resolveExcelLabel,
} from "@/lib/csv/ticketCsvMapping";
import {
  type TicketCategory,
  categoryByIndex,
  TICKET_CATEGORY_RANGES,
} from "@/lib/csv/ticketCategoryRanges";

const NORMALIZED_LABELS = EXCEL_TICKET_LABELS.map(normalizeTicketLabel);

function labelIndex(label: string): number {
  return NORMALIZED_LABELS.indexOf(normalizeTicketLabel(label));
}

/**
 * チケットCSV 1行 → 実績管理表ラベル index（0-79）。
 */
export function mapTicketRowToIndex(
  receptionName: string,
  ticketType: string,
): number {
  const resolved = resolveExcelLabel(receptionName, ticketType);
  if (resolved) {
    const idx = labelIndex(resolved);
    if (idx >= 0) return idx;
  }

  // フォールバック: H列が Excel ラベル完全一致（レガシーデータ）
  const typ = normalizeTicketLabel(ticketType);
  const exactIdx = labelIndex(typ);
  if (exactIdx >= 0) {
    const catFromRec = categoryFromReceptionName(receptionName);
    const catFromExact = categoryByIndex(exactIdx);
    if (
      catFromRec !== "skip" &&
      (catFromRec === "general" ||
        catFromRec === null ||
        catFromRec === catFromExact)
    ) {
      return exactIdx;
    }
  }

  return -1;
}

/** テスト・検証用: 各カテゴリの行数 */
export function categoryRowCounts(): Record<TicketCategory, number> {
  const counts = {} as Record<TicketCategory, number>;
  for (const range of TICKET_CATEGORY_RANGES) {
    counts[range.id] = range.end - range.start + 1;
  }
  return counts;
}
