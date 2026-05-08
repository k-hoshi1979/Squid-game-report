/** 構造化日報データ。DB の content カラムに JSON 文字列として保存する */
export interface ReportData {
  version: 1;
  date: string;       // YYYY-MM-DD
  reporter: string;

  /** CSVから取り込んだチケット販売データ */
  csv: {
    eventName: string;
    venue: string;
    datetimes: string[];
    groups: CsvTicketGroup[];  // 受付名別グループ
    rows: CsvTicketRow[];      // フラットリスト
    totalCount: number;
    totalAmount: number;
  } | null;

  /** 特典残数 */
  tokuten: {
    prevRemaining: number;  // 前日残数
    todayRemaining: number; // 当日残数
    salesCount: number;     // 当日販売数 = 前日 - 当日
    unitPrice: number;
    amount: number;         // salesCount × unitPrice
  };

  /** 貸切VIP */
  kashikiriVip: {
    prevTotal: number;  // 前日累計
    todayTotal: number; // 本日累計
    salesCount: number; // 当日販売数 = 本日 - 前日
    unitPrice: number;
    amount: number;
  };

  /** チケット売上合計 (CSV + 特典 + 貸切VIP) */
  ticketTotal: {
    count: number;
    amountTaxIn: number;  // 税込（表示金額）
    amountTaxEx: number;  // 税抜 = 税込 ÷ 1.1
  };

  /** リテール販売 */
  retail: {
    salesTaxEx: number; // 物販売り上げ（税抜・手入力）
    salesTaxIn: number; // 物販売り上げ（税込・手入力）
    paymentCount: number;
  };

  /** IB対応チケット */
  ibTickets: {
    genWeekday:   IbTicketRow; // 一般（平日）  ¥4,230
    genHoliday:   IbTicketRow; // 一般（休日）  ¥4,430
    childWeekday: IbTicketRow; // こども（平日）¥3,630
    childHoliday: IbTicketRow; // こども（休日）¥3,830
    genVipWeekday:   IbTicketRow; // 一般VIP（平日）  ¥6,230
    genVipHoliday:   IbTicketRow; // 一般VIP（休日）  ¥6,430
    childVipWeekday: IbTicketRow; // こどもVIP（平日）¥5,630
    childVipHoliday: IbTicketRow; // こどもVIP（休日）¥5,830
    vip:          IbTicketRow; // 貸切VIP       ¥2,330
    totalCount: number;
    totalAmount: number;
  };

  operationNotes: string;   // 運営所感
  irregularReport: string;  // イレギュラー報告
}

export interface CsvTicketRow {
  receptionName: string; // 受付名（E列）
  ticketType: string;    // 販売区分（H列）
  unitPrice: number;
  count: number;
  amount: number;
}

export interface CsvTicketGroup {
  receptionName: string;
  rows: CsvTicketRow[];
  subtotalCount: number;
  subtotalAmount: number;
}

export interface IbTicketRow {
  count: number;
  unitPrice: number;
  amount: number;
}

/** IB対応チケットの固定単価（入力・再計算・旧データ補完で共通） */
export const IB_UNIT_PRICE_BY_KEY = {
  genWeekday:   4230,
  genHoliday:   4430,
  childWeekday: 3630,
  childHoliday: 3830,
  genVipWeekday:   6230,
  genVipHoliday:   6430,
  childVipWeekday: 5630,
  childVipHoliday: 5830,
  vip:          2330,
} as const;

export type IbTicketPriceKey = keyof typeof IB_UNIT_PRICE_BY_KEY;

/** 旧日報JSON（4券種追加前）にも対応して ibTickets を埋める */
export function ibTicketsWithDefaults(
  ib: Partial<ReportData["ibTickets"]> | undefined | null,
): ReportData["ibTickets"] {
  const z = (price: number): IbTicketRow => ({ count: 0, unitPrice: price, amount: 0 });
  const P = IB_UNIT_PRICE_BY_KEY;
  if (!ib) {
    return {
      genWeekday:      z(P.genWeekday),
      genHoliday:      z(P.genHoliday),
      childWeekday:    z(P.childWeekday),
      childHoliday:    z(P.childHoliday),
      genVipWeekday:   z(P.genVipWeekday),
      genVipHoliday:   z(P.genVipHoliday),
      childVipWeekday: z(P.childVipWeekday),
      childVipHoliday: z(P.childVipHoliday),
      vip:             z(P.vip),
      totalCount:      0,
      totalAmount:     0,
    };
  }
  return {
    genWeekday:      ib.genWeekday      ?? z(P.genWeekday),
    genHoliday:      ib.genHoliday      ?? z(P.genHoliday),
    childWeekday:    ib.childWeekday    ?? z(P.childWeekday),
    childHoliday:    ib.childHoliday    ?? z(P.childHoliday),
    genVipWeekday:   ib.genVipWeekday   ?? z(P.genVipWeekday),
    genVipHoliday:   ib.genVipHoliday   ?? z(P.genVipHoliday),
    childVipWeekday: ib.childVipWeekday ?? z(P.childVipWeekday),
    childVipHoliday: ib.childVipHoliday ?? z(P.childVipHoliday),
    vip:             ib.vip             ?? z(P.vip),
    totalCount:      ib.totalCount      ?? 0,
    totalAmount:     ib.totalAmount     ?? 0,
  };
}

/** content フィールドから ReportData を安全にパースする */
export function parseReportContent(content: string): ReportData | null {
  try {
    const data = JSON.parse(content);
    if (data?.version === 1 && data?.date) return data as ReportData;
    return null;
  } catch {
    return null;
  }
}

function coerceNum(n: unknown, fallback = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

/**
 * 編集フォーム用。欠損・旧形式フィールドでも落ちずに入力初期値へ埋める。
 */
export function sanitizeReportForForm(raw: ReportData): ReportData {
  const t = raw.tokuten;
  const kv = raw.kashikiriVip;
  const tt = raw.ticketTotal;
  const r = raw.retail;
  return {
    ...raw,
    reporter: typeof raw.reporter === "string" ? raw.reporter : "",
    operationNotes: typeof raw.operationNotes === "string" ? raw.operationNotes : "",
    irregularReport: typeof raw.irregularReport === "string" ? raw.irregularReport : "",
    tokuten: {
      prevRemaining: coerceNum(t?.prevRemaining),
      todayRemaining: coerceNum(t?.todayRemaining),
      salesCount: coerceNum(t?.salesCount),
      unitPrice: coerceNum(t?.unitPrice, 14_000) || 14_000,
      amount: coerceNum(t?.amount),
    },
    kashikiriVip: {
      prevTotal: coerceNum(kv?.prevTotal),
      todayTotal: coerceNum(kv?.todayTotal),
      salesCount: coerceNum(kv?.salesCount),
      unitPrice: coerceNum(kv?.unitPrice, 2_000) || 2_000,
      amount: coerceNum(kv?.amount),
    },
    ticketTotal: {
      count: coerceNum(tt?.count),
      amountTaxIn: coerceNum(tt?.amountTaxIn),
      amountTaxEx: coerceNum(tt?.amountTaxEx),
    },
    retail: {
      salesTaxEx: coerceNum(r?.salesTaxEx),
      salesTaxIn: coerceNum(r?.salesTaxIn),
      paymentCount: coerceNum(r?.paymentCount),
    },
    ibTickets: ibTicketsWithDefaults(raw.ibTickets),
  };
}
