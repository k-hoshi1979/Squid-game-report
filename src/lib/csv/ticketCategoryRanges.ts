/** 実績管理表 B21 起点のカテゴリ */
export type TicketCategory =
  | "general"
  | "discount500"
  | "specialPlan"
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

export const TICKET_CATEGORY_RANGES: readonly TicketCategoryRange[] = [
  { id: "general",       start: 0,  end: 18 },
  { id: "discount500",   start: 19, end: 26 },
  { id: "specialPlan",   start: 27, end: 27 },
  { id: "ib",            start: 28, end: 46 },
  { id: "discount500ib", start: 47, end: 54 },
  { id: "inner",         start: 55, end: 62 },
  { id: "dentsu",        start: 63, end: 71 },
  { id: "nta",           start: 72, end: 80 },
  { id: "uridome",       start: 81, end: 99 },
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
