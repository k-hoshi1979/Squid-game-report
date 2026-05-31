/** 実績管理表 B21:B100 の7カテゴリ（CSV A4:A83 に対応） */
export type TicketCategory =
  | "general"
  | "discount500"
  | "ib"
  | "discount500ib"
  | "inner"
  | "dentsu"
  | "nta"
  | "uridome";

export interface TicketCategoryRange {
  id: TicketCategory;
  /** EXCEL_TICKET_LABELS 内の開始インデックス（含む） */
  start: number;
  /** 終了インデックス（含む） */
  end: number;
}

/** A4-A22, A23-A30, A31-A49, A50-A57, A58-A65, A66-A74, A75-A83 */
export const TICKET_CATEGORY_RANGES: readonly TicketCategoryRange[] = [
  { id: "general",       start: 0,  end: 18 },
  { id: "discount500",   start: 19, end: 26 },
  { id: "ib",            start: 27, end: 45 },
  { id: "discount500ib", start: 46, end: 53 },
  { id: "inner",         start: 54, end: 61 },
  { id: "dentsu",        start: 62, end: 70 },
  { id: "nta",           start: 71, end: 79 },
  { id: "uridome",       start: 80, end: 98 },
];

export function categoryByIndex(index: number): TicketCategory | null {
  for (const range of TICKET_CATEGORY_RANGES) {
    if (index >= range.start && index <= range.end) return range.id;
  }
  return null;
}

export function rangeForCategory(id: TicketCategory): TicketCategoryRange {
  return TICKET_CATEGORY_RANGES.find((r) => r.id === id)!;
}
