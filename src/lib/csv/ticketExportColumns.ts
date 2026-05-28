/** チケットCSV取込データをピボット出力する際の列定義（抽出項目名・82項目順） */

export interface TicketExportColumn {
  /** CSVヘッダー（画像の項目名そのまま） */
  header: string;
  /** 受付名（E列）。空文字は全体セクション */
  receptionName: string;
  /** 販売区分（H列） */
  ticketType: string;
}

const BASE_METRICS = [
  "一部（ユニット込み）",
  "200（ユニット込み）",
  "プリセット数",
  "プリセット枚数",
  "一部カウント",
  "200カウント",
  "プリセット一部カウント",
  "プリセット200カウント",
] as const;

const TOTAL_SECTION_METRICS = [
  ...BASE_METRICS,
  "サービス（ユニット込み）",
  "広告（ユニット込み）",
  "別刷（ユニット込み）",
  "合計（ユニット込み）",
  "プリセット合計（ユニット込み）",
  "プリセット合計枚数（ユニット込み）",
  "合計カウント",
  "プリセット合計カウント",
  "スタート（一部）",
  "スタート（200）",
  "スタート（一部）カウント",
  "スタート（200）カウント",
] as const;

function sectionColumns(
  receptionName: string,
  metrics: readonly string[],
): TicketExportColumn[] {
  return metrics.map((ticketType) => ({
    header: receptionName ? `${receptionName} ${ticketType}` : ticketType,
    receptionName,
    ticketType,
  }));
}

/** 画像どおりの82列（受付名×販売区分） */
export const TICKET_EXPORT_COLUMNS: TicketExportColumn[] = [
  ...sectionColumns("", TOTAL_SECTION_METRICS),
  ...sectionColumns("insertable", BASE_METRICS),
  ...sectionColumns("10", TOTAL_SECTION_METRICS),
  ...sectionColumns("insertable 10", BASE_METRICS),
  ...sectionColumns("11", BASE_METRICS),
  ...sectionColumns("20", [...BASE_METRICS, "合計"]),
  ...sectionColumns("21", [...BASE_METRICS, "合計"]),
];

export const TICKET_EXPORT_COLUMN_COUNT = TICKET_EXPORT_COLUMNS.length;
