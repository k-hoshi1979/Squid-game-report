/** 実績管理表 B21 起点のカテゴリ */
export type TicketCategory =
  | "general"
  | "discount500"
  | "luup"
  | "limitedPlan"
  | "specialPlan"
  | "ib"
  | "discount500ib"
  | "luupIb"
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
  { id: "luup",          start: 27, end: 30 },
  { id: "limitedPlan",   start: 31, end: 31 },
  { id: "specialPlan",   start: 32, end: 32 },
  { id: "ib",            start: 33, end: 51 },
  { id: "discount500ib", start: 52, end: 59 },
  { id: "luupIb",        start: 60, end: 63 },
  { id: "inner",         start: 64, end: 71 },
  { id: "dentsu",        start: 72, end: 80 },
  { id: "nta",           start: 81, end: 89 },
  { id: "uridome",       start: 90, end: 108 },
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
