import {
  APPEND_EXPORT_FIELDS,
  EXCEL_TICKET_LABELS,
  RETAIL_EXPORT_FIELD_COUNT,
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

/** 実績管理表 CSV のリテール項目数（物販税抜・税込・決済件数） */
export const APPEND_RETAIL_FIELD_COUNT = RETAIL_EXPORT_FIELD_COUNT;

/** 項目一覧「リテール売上」タブの行ラベル */
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

/** 項目一覧「チケット売上」タブの行ラベル（特典・貸切VIPは当日販売数を表示） */
export const TICKET_SECTION_LABELS: readonly string[] = [
  ...EXCEL_TICKET_LABELS,
  ...TICKET_SUPPLEMENT_LABELS,
];

export const TICKET_TOTAL_LABEL = "チケット合計" as const;

/** 項目一覧「チケット売上」表示用（先頭に日次合算のチケット合計） */
export const TICKET_DISPLAY_LABELS: readonly string[] = [
  TICKET_TOTAL_LABEL,
  ...TICKET_SECTION_LABELS,
];

export const TICKET_ITEM_COUNT = TICKET_SECTION_LABELS.length;

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
    labels: TICKET_DISPLAY_LABELS,
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

export type ItemListExportCategory = "numeric" | "text";

export const ITEM_LIST_NUMERIC_SECTIONS = ITEM_LIST_SECTIONS.filter(
  (section) => section.kind === "numeric",
);

export const ITEM_LIST_TEXT_SECTIONS = ITEM_LIST_SECTIONS.filter(
  (section) => section.kind === "text",
);

export const ITEM_LIST_NUMERIC_SECTION_IDS = ITEM_LIST_NUMERIC_SECTIONS.map(
  (section) => section.id,
);

export const ITEM_LIST_TEXT_SECTION_IDS = ITEM_LIST_TEXT_SECTIONS.map(
  (section) => section.id,
);

/** 日付ごとの全チケット券種合計（チケット合計行用） */
export function sumTicketValuesForDate(values: number[] | undefined): number {
  if (!values) return 0;
  let sum = 0;
  for (let i = 0; i < TICKET_ITEM_COUNT; i++) {
    sum += values[i] ?? 0;
  }
  return sum;
}

export function sumTicketValuesAcrossDays(
  days: readonly string[],
  valuesByDate: Record<string, number[]>,
): number {
  let sum = 0;
  for (const date of days) {
    sum += sumTicketValuesForDate(valuesByDate[date]);
  }
  return sum;
}

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
