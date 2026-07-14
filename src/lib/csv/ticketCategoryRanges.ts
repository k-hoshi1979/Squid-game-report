/** 実績管理表 B21 起点のカテゴリ */
export type TicketCategory =
  | "general"
  | "discount500"
  | "limitedPlan"
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
  { id: "limitedPlan",   start: 27, end: 27 },
  { id: "specialPlan",   start: 28, end: 28 },
  { id: "ib",            start: 29, end: 47 },
  { id: "discount500ib", start: 48, end: 55 },
  { id: "inner",         start: 56, end: 63 },
  { id: "dentsu",        start: 64, end: 72 },
  { id: "nta",           start: 73, end: 81 },
  { id: "uridome",       start: 82, end: 100 },
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
