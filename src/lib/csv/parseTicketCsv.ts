import Papa from "papaparse";

/** CSVの列インデックス */
const COL = {
  EVENT: 0,       // 興行名１
  VENUE: 2,       // 会場名
  DATETIME: 3,    // 公演日時
  RECEPTION: 4,   // 受付名 (E列)
  TICKET_TYPE: 7, // 販売区分名 (H列)
  PRICE: 8,       // 料金 (I列)
  CONFIRMED: 10,  // 購入確定数 (K列)
} as const;

export interface TicketSummaryRow {
  receptionName: string; // E列: 受付名
  ticketType: string;    // H列: 販売区分
  unitPrice: number;
  count: number;
  amount: number;
}

/** 受付名ごとのグループ */
export interface TicketGroup {
  receptionName: string;
  rows: TicketSummaryRow[];
  subtotalCount: number;
  subtotalAmount: number;
}

export interface CsvParseResult {
  eventName: string;
  venue: string;
  datetimes: string[];
  groups: TicketGroup[];       // 受付名でグループ化した集計
  rows: TicketSummaryRow[];    // フラットリスト（後方互換）
  totalCount: number;
  totalAmount: number;
}

/** "4,100" → 4100 */
function parseNumber(s: string): number {
  return parseInt(s.replace(/,/g, "").trim(), 10) || 0;
}

/**
 * ArrayBuffer を Shift-JIS として文字列に変換する
 */
export function decodeShiftJis(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder("shift_jis");
  return decoder.decode(buffer);
}

/** CSVテキスト (UTF-8/Shift-JIS済み) を集計結果に変換する */
export function parseTicketCsv(csvText: string): CsvParseResult {
  const result = Papa.parse<string[]>(csvText, {
    skipEmptyLines: true,
  });

  const rows = result.data as string[][];
  if (rows.length < 2) {
    return {
      eventName: "",
      venue: "",
      datetimes: [],
      groups: [],
      rows: [],
      totalCount: 0,
      totalAmount: 0,
    };
  }

  const dataRows = rows.slice(1); // ヘッダーをスキップ

  const eventName =
    dataRows.find((r) => r[COL.EVENT]?.trim())?.[COL.EVENT]?.trim() ?? "";
  const venue =
    dataRows.find((r) => r[COL.VENUE]?.trim())?.[COL.VENUE]?.trim() ?? "";
  const datetimes = [
    ...new Set(dataRows.map((r) => r[COL.DATETIME]?.trim()).filter(Boolean)),
  ].sort();

  // 受付名 + 販売区分 をキーに集計
  // key: "受付名||販売区分"
  const map = new Map<string, { receptionName: string; ticketType: string; unitPrice: number; count: number }>();

  for (const row of dataRows) {
    const receptionName = row[COL.RECEPTION]?.trim() ?? "";
    const ticketType    = row[COL.TICKET_TYPE]?.trim() ?? "";
    const count         = parseNumber(row[COL.CONFIRMED] ?? "");
    const price         = parseNumber(row[COL.PRICE] ?? "");

    if (!ticketType || count <= 0) continue;

    const key = `${receptionName}||${ticketType}`;
    const existing = map.get(key);
    if (existing) {
      existing.count += count;
    } else {
      map.set(key, { receptionName, ticketType, unitPrice: price, count });
    }
  }

  // フラットリスト（受付名→枚数降順）
  const summaryRows: TicketSummaryRow[] = [...map.values()]
    .map(({ receptionName, ticketType, unitPrice, count }) => ({
      receptionName,
      ticketType,
      unitPrice,
      count,
      amount: unitPrice * count,
    }))
    .sort((a, b) =>
      a.receptionName.localeCompare(b.receptionName, "ja") ||
      b.count - a.count
    );

  // 受付名ごとにグループ化
  const groupMap = new Map<string, TicketSummaryRow[]>();
  for (const row of summaryRows) {
    const list = groupMap.get(row.receptionName) ?? [];
    list.push(row);
    groupMap.set(row.receptionName, list);
  }

  const groups: TicketGroup[] = [...groupMap.entries()].map(
    ([receptionName, groupRows]) => ({
      receptionName,
      rows: groupRows,
      subtotalCount: groupRows.reduce((s, r) => s + r.count, 0),
      subtotalAmount: groupRows.reduce((s, r) => s + r.amount, 0),
    })
  );

  const totalCount  = summaryRows.reduce((s, r) => s + r.count, 0);
  const totalAmount = summaryRows.reduce((s, r) => s + r.amount, 0);

  return { eventName, venue, datetimes, groups, rows: summaryRows, totalCount, totalAmount };
}

/** 集計結果を日報本文テキストに変換する */
export function formatTicketSummary(result: CsvParseResult): string {
  const fmt = new Intl.NumberFormat("ja-JP");
  const dateRange =
    result.datetimes.length > 0 ? result.datetimes.join(" / ") : "";

  const lines: string[] = [
    "【チケット販売集計】",
    `公演日時: ${dateRange}`,
    `イベント: ${result.eventName}`,
    `会場:     ${result.venue}`,
    "─".repeat(50),
  ];

  for (const group of result.groups) {
    lines.push(`▼ ${group.receptionName}`);
    for (const row of group.rows) {
      const type   = row.ticketType.padEnd(14, "　");
      const count  = String(row.count).padStart(4);
      const amount = fmt.format(row.amount).padStart(10);
      lines.push(`  ${type}  ${count}枚  ¥${amount}`);
    }
    lines.push(
      `  ${"小計".padEnd(14, "　")}  ${String(group.subtotalCount).padStart(4)}枚  ¥${fmt.format(group.subtotalAmount).padStart(10)}`
    );
    lines.push("");
  }

  lines.push("─".repeat(50));
  lines.push(
    `${"合計".padEnd(16, "　")}  ${String(result.totalCount).padStart(4)}枚  ¥${fmt.format(result.totalAmount).padStart(10)}`
  );

  return lines.join("\n");
}
