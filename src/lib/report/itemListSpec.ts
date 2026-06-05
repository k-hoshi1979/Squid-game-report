import {
  APPEND_EXPORT_FIELDS,
  EXCEL_TICKET_LABELS,
  TICKET_SUPPLEMENT_LABELS,
} from "@/lib/csv/excelExportSpec";

export { TICKET_SUPPLEMENT_LABELS };

export type ItemListSectionId =
  | "ticket"
  | "retail"
  | "jersey"
  | "ib"
  | "policyMeasures"
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

export const RETAIL_LABEL_COUNT = RETAIL_LABELS.length;

/** 項目一覧用（CSVエクスポートより枚数合計を追加） */
const JERSEY_LABELS = [
  "ジャージレンタル通常",
  "ジャージレンタルSNS",
  "枚数合計",
  "レンタル合計",
] as const;

const IB_LABELS = APPEND_EXPORT_FIELDS.filter(
  (f) => f.section === "■IB対応チケット",
).map((f) => f.header);

const POLICY_MEASURES_LABELS = [
  "①イカゲーム500円引き券回収",
  "②シリアルカード配布",
  "③お食事割引券配布",
] as const;

const SNS_LABELS = ["〇", "▢", "合計"] as const;

/** 項目一覧の数値配列インデックス（通期合計は最終日報日の値を表示） */
export const TICKET_TOKUTEN_VALUE_INDEX = EXCEL_TICKET_LABELS.length;
export const TICKET_KASHIKIRI_VIP_VALUE_INDEX = EXCEL_TICKET_LABELS.length + 1;

/** 通期合計に当月の最終日報入力日の値を使う行 */
export function usesLastReportDayForPeriodTotal(
  sectionId: ItemListSectionId,
  valueIndex: number,
): boolean {
  return (
    sectionId === "ticket" &&
    (valueIndex === TICKET_TOKUTEN_VALUE_INDEX ||
      valueIndex === TICKET_KASHIKIRI_VIP_VALUE_INDEX)
  );
}

/** 項目一覧「チケット売上」タブの行ラベル */
export const TICKET_SECTION_LABELS: readonly string[] = [
  ...EXCEL_TICKET_LABELS,
  ...TICKET_SUPPLEMENT_LABELS,
];

const TICKET_OFFSET = 0;
const RETAIL_OFFSET = TICKET_SECTION_LABELS.length;
const JERSEY_OFFSET = RETAIL_OFFSET + RETAIL_LABELS.length;
const IB_OFFSET = JERSEY_OFFSET + JERSEY_LABELS.length;
const POLICY_MEASURES_OFFSET = IB_OFFSET + IB_LABELS.length;

/** 項目一覧のセクション定義（タブ表示順。rowOffset は数値配列内の位置） */
export const ITEM_LIST_SECTIONS: readonly ItemListSection[] = [
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
    id: "ticket",
    tabLabel: "チケット売上",
    kind: "numeric",
    labels: TICKET_SECTION_LABELS,
    rowOffset: TICKET_OFFSET,
  },
  {
    id: "ib",
    tabLabel: "IBチケット対応",
    kind: "numeric",
    labels: IB_LABELS,
    rowOffset: IB_OFFSET,
  },
  {
    id: "policyMeasures",
    tabLabel: "施策対応",
    kind: "numeric",
    labels: POLICY_MEASURES_LABELS,
    rowOffset: POLICY_MEASURES_OFFSET,
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

export const DEFAULT_ITEM_LIST_SECTION: ItemListSectionId = "retail";

export const NUMERIC_ROW_COUNT =
  POLICY_MEASURES_OFFSET + POLICY_MEASURES_LABELS.length;

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
