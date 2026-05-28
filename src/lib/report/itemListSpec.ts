import {
  APPEND_EXPORT_FIELDS,
  EXCEL_TICKET_LABELS,
} from "@/lib/csv/excelExportSpec";

export type ItemListSectionId =
  | "ticket"
  | "retail"
  | "jersey"
  | "ib"
  | "sns"
  | "operation"
  | "irregular"
  | "lostAndFound";

export type ItemListSectionKind = "numeric" | "text";

export interface ItemListSection {
  id: ItemListSectionId;
  tabLabel: string;
  kind: ItemListSectionKind;
  labels: readonly string[];
  rowOffset: number;
}

const RETAIL_LABELS = APPEND_EXPORT_FIELDS.filter(
  (f) => f.section === "■リテール売上",
).map((f) => f.header);

const JERSEY_LABELS = APPEND_EXPORT_FIELDS.filter(
  (f) => f.section === "■ジャージレンタル",
).map((f) => f.header);

const IB_LABELS = APPEND_EXPORT_FIELDS.filter(
  (f) => f.section === "■IB対応チケット",
).map((f) => f.header);

const SNS_LABELS = ["〇", "▢", "合計"] as const;

const TICKET_OFFSET = 0;
const RETAIL_OFFSET = EXCEL_TICKET_LABELS.length;
const JERSEY_OFFSET = RETAIL_OFFSET + RETAIL_LABELS.length;
const IB_OFFSET = JERSEY_OFFSET + JERSEY_LABELS.length;

/** 項目一覧のセクション定義（表示順＝数値配列の順） */
export const ITEM_LIST_SECTIONS: readonly ItemListSection[] = [
  {
    id: "ticket",
    tabLabel: "チケット売上",
    kind: "numeric",
    labels: EXCEL_TICKET_LABELS,
    rowOffset: TICKET_OFFSET,
  },
  {
    id: "retail",
    tabLabel: "リテール売上",
    kind: "numeric",
    labels: RETAIL_LABELS,
    rowOffset: RETAIL_OFFSET,
  },
  {
    id: "jersey",
    tabLabel: "ジャージレンタル",
    kind: "numeric",
    labels: JERSEY_LABELS,
    rowOffset: JERSEY_OFFSET,
  },
  {
    id: "ib",
    tabLabel: "IBチケット対応",
    kind: "numeric",
    labels: IB_LABELS,
    rowOffset: IB_OFFSET,
  },
  {
    id: "sns",
    tabLabel: "SNS投稿",
    kind: "numeric",
    labels: SNS_LABELS,
    rowOffset: 0,
  },
  {
    id: "operation",
    tabLabel: "運営所感",
    kind: "text",
    labels: [],
    rowOffset: 0,
  },
  {
    id: "irregular",
    tabLabel: "イレギュラー対応",
    kind: "text",
    labels: [],
    rowOffset: 0,
  },
  {
    id: "lostAndFound",
    tabLabel: "落とし物取得",
    kind: "text",
    labels: [],
    rowOffset: 0,
  },
];

export const DEFAULT_ITEM_LIST_SECTION: ItemListSectionId = "ticket";

export const NUMERIC_ROW_COUNT = IB_OFFSET + IB_LABELS.length;

export function parseSectionId(raw: string | undefined): ItemListSectionId {
  if (raw && ITEM_LIST_SECTIONS.some((s) => s.id === raw)) {
    return raw as ItemListSectionId;
  }
  return DEFAULT_ITEM_LIST_SECTION;
}

export function getSectionById(id: ItemListSectionId): ItemListSection {
  return (
    ITEM_LIST_SECTIONS.find((s) => s.id === id) ??
    ITEM_LIST_SECTIONS[0]
  );
}
