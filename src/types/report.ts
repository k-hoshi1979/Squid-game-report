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
    amountTaxEx: number;  // 税抜 = 税込 ÷ 1.1（端数切り捨て）
  };

  /** 施策対応（チケット売上とリテール売上の間） */
  policyMeasures: {
    game500CouponCollected: number;  // ①イカゲーム500円引き券回収
    serialCardDistributed: number;     // ②シリアルカード配布
    mealDiscountDistributed: number;   // ③お食事割引券配布
  };

  /** リテール販売 */
  retail: {
    salesTaxEx: number; // 物販売り上げ（税抜・手入力）
    salesTaxIn: number; // 物販売り上げ（税込・手入力）
    paymentCount: number;
  };

  /**
   * ジャージレンタル（リテール売上には含めない）
   * レンタル合計 ＝ 小計金額① ＋ 小計金額②
   */
  jerseyRental: {
    normalCount: number;
    snsCount: number;
    unitPriceNormal: number; // 通常 ¥1500
    unitPriceSns: number; // SNS ¥1000
    subtotalNormal: number;
    subtotalSns: number;
    totalAmount: number;
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
    genWeekdayDiscount500: IbTicketRow; // 【500円引き】一般（平日）  ¥3,730
    genHolidayDiscount500: IbTicketRow;
    childWeekdayDiscount500: IbTicketRow;
    childHolidayDiscount500: IbTicketRow;
    genVipWeekdayDiscount500: IbTicketRow;
    genVipHolidayDiscount500: IbTicketRow;
    childVipWeekdayDiscount500: IbTicketRow;
    childVipHolidayDiscount500: IbTicketRow;
    vip:          IbTicketRow; // 貸切VIP       ¥2,330
    totalCount: number;
    totalAmount: number;
  };

  operationNotes: string;   // 運営所感
  irregularReport: string;  // イレギュラー報告

  /** SNS投稿（運営所感の前） */
  snsPost: {
    circleCount: number;  // 〇
    squareCount: number;  // ▢
    totalCount: number;   // 合計（〇＋▢）
  };

  lostAndFound: string;     // 落とし物取得
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

/** IB【500円引き】は通常単価からこの金額を引く */
export const IB_DISCOUNT_YEN = 500;

/** 貸切VIPを除く8券種の【500円引き】単価（通常単価 − 500円） */
export const IB_UNIT_PRICE_DISCOUNT500_BY_KEY = {
  genWeekdayDiscount500: IB_UNIT_PRICE_BY_KEY.genWeekday - IB_DISCOUNT_YEN,
  genHolidayDiscount500: IB_UNIT_PRICE_BY_KEY.genHoliday - IB_DISCOUNT_YEN,
  childWeekdayDiscount500: IB_UNIT_PRICE_BY_KEY.childWeekday - IB_DISCOUNT_YEN,
  childHolidayDiscount500: IB_UNIT_PRICE_BY_KEY.childHoliday - IB_DISCOUNT_YEN,
  genVipWeekdayDiscount500: IB_UNIT_PRICE_BY_KEY.genVipWeekday - IB_DISCOUNT_YEN,
  genVipHolidayDiscount500: IB_UNIT_PRICE_BY_KEY.genVipHoliday - IB_DISCOUNT_YEN,
  childVipWeekdayDiscount500: IB_UNIT_PRICE_BY_KEY.childVipWeekday - IB_DISCOUNT_YEN,
  childVipHolidayDiscount500: IB_UNIT_PRICE_BY_KEY.childVipHoliday - IB_DISCOUNT_YEN,
} as const;

export type IbDiscount500TicketKey = keyof typeof IB_UNIT_PRICE_DISCOUNT500_BY_KEY;

export type IbTicketRowKey = Exclude<
  keyof ReportData["ibTickets"],
  "totalCount" | "totalAmount"
>;

/** 日報フォーム・詳細の表示順（通常8 → 【500円引き】8 → 貸切VIP） */
export const IB_TICKET_FORM_SPECS: readonly {
  key: IbTicketRowKey;
  label: string;
  unitPrice: number;
}[] = [
  { key: "genWeekday", label: "一般（平日）", unitPrice: IB_UNIT_PRICE_BY_KEY.genWeekday },
  { key: "genHoliday", label: "一般（休日）", unitPrice: IB_UNIT_PRICE_BY_KEY.genHoliday },
  { key: "childWeekday", label: "こども（平日）", unitPrice: IB_UNIT_PRICE_BY_KEY.childWeekday },
  { key: "childHoliday", label: "こども（休日）", unitPrice: IB_UNIT_PRICE_BY_KEY.childHoliday },
  { key: "genVipWeekday", label: "一般VIP（平日）", unitPrice: IB_UNIT_PRICE_BY_KEY.genVipWeekday },
  { key: "genVipHoliday", label: "一般VIP（休日）", unitPrice: IB_UNIT_PRICE_BY_KEY.genVipHoliday },
  { key: "childVipWeekday", label: "こどもVIP（平日）", unitPrice: IB_UNIT_PRICE_BY_KEY.childVipWeekday },
  { key: "childVipHoliday", label: "こどもVIP（休日）", unitPrice: IB_UNIT_PRICE_BY_KEY.childVipHoliday },
  {
    key: "genWeekdayDiscount500",
    label: "【500円引き】一般（平日）",
    unitPrice: IB_UNIT_PRICE_DISCOUNT500_BY_KEY.genWeekdayDiscount500,
  },
  {
    key: "genHolidayDiscount500",
    label: "【500円引き】一般（休日）",
    unitPrice: IB_UNIT_PRICE_DISCOUNT500_BY_KEY.genHolidayDiscount500,
  },
  {
    key: "childWeekdayDiscount500",
    label: "【500円引き】こども（平日）",
    unitPrice: IB_UNIT_PRICE_DISCOUNT500_BY_KEY.childWeekdayDiscount500,
  },
  {
    key: "childHolidayDiscount500",
    label: "【500円引き】こども（休日）",
    unitPrice: IB_UNIT_PRICE_DISCOUNT500_BY_KEY.childHolidayDiscount500,
  },
  {
    key: "genVipWeekdayDiscount500",
    label: "【500円引き】一般VIP（平日）",
    unitPrice: IB_UNIT_PRICE_DISCOUNT500_BY_KEY.genVipWeekdayDiscount500,
  },
  {
    key: "genVipHolidayDiscount500",
    label: "【500円引き】一般VIP（休日）",
    unitPrice: IB_UNIT_PRICE_DISCOUNT500_BY_KEY.genVipHolidayDiscount500,
  },
  {
    key: "childVipWeekdayDiscount500",
    label: "【500円引き】こどもVIP（平日）",
    unitPrice: IB_UNIT_PRICE_DISCOUNT500_BY_KEY.childVipWeekdayDiscount500,
  },
  {
    key: "childVipHolidayDiscount500",
    label: "【500円引き】こどもVIP（休日）",
    unitPrice: IB_UNIT_PRICE_DISCOUNT500_BY_KEY.childVipHolidayDiscount500,
  },
  { key: "vip", label: "貸切VIP", unitPrice: IB_UNIT_PRICE_BY_KEY.vip },
];

export const IB_TICKET_ROW_KEYS: readonly IbTicketRowKey[] =
  IB_TICKET_FORM_SPECS.map((s) => s.key);

export const JERSEY_RENTAL_UNIT_NORMAL = 1500;
export const JERSEY_RENTAL_UNIT_SNS = 1000;

export function snsPostWithDefaults(
  s: Partial<ReportData["snsPost"]> | undefined | null,
): ReportData["snsPost"] {
  const circleCount = coerceNum(s?.circleCount);
  const squareCount = coerceNum(s?.squareCount);
  return {
    circleCount,
    squareCount,
    totalCount: circleCount + squareCount,
  };
}

export function policyMeasuresWithDefaults(
  p: Partial<ReportData["policyMeasures"]> | undefined | null,
): ReportData["policyMeasures"] {
  return {
    game500CouponCollected: coerceNum(p?.game500CouponCollected),
    serialCardDistributed: coerceNum(p?.serialCardDistributed),
    mealDiscountDistributed: coerceNum(p?.mealDiscountDistributed),
  };
}

export function jerseyRentalWithDefaults(
  j: Partial<ReportData["jerseyRental"]> | undefined | null,
): ReportData["jerseyRental"] {
  const nc = coerceNum(j?.normalCount);
  const sc = coerceNum(j?.snsCount);
  const subN = nc * JERSEY_RENTAL_UNIT_NORMAL;
  const subS = sc * JERSEY_RENTAL_UNIT_SNS;
  return {
    normalCount: nc,
    snsCount: sc,
    unitPriceNormal: JERSEY_RENTAL_UNIT_NORMAL,
    unitPriceSns: JERSEY_RENTAL_UNIT_SNS,
    subtotalNormal: subN,
    subtotalSns: subS,
    totalAmount: subN + subS,
  };
}

function mergeIbTicketRow(
  partial: Partial<IbTicketRow> | undefined,
  unitPrice: number,
): IbTicketRow {
  const count = coerceNum(partial?.count);
  return { count, unitPrice, amount: count * unitPrice };
}

/** 各券種から IB 合計枚数・金額を再計算 */
export function computeIbTicketTotals(
  rows: Pick<ReportData["ibTickets"], IbTicketRowKey>,
): Pick<ReportData["ibTickets"], "totalCount" | "totalAmount"> {
  let totalCount = 0;
  let totalAmount = 0;
  for (const spec of IB_TICKET_FORM_SPECS) {
    const row = rows[spec.key];
    totalCount += row.count;
    totalAmount += row.amount;
  }
  return { totalCount, totalAmount };
}

/** 旧日報JSON（IB券種不足時）にも対応して ibTickets を埋める */
export function ibTicketsWithDefaults(
  ib: Partial<ReportData["ibTickets"]> | undefined | null,
): ReportData["ibTickets"] {
  const rows = Object.fromEntries(
    IB_TICKET_FORM_SPECS.map((spec) => [
      spec.key,
      mergeIbTicketRow(
        ib?.[spec.key] as Partial<IbTicketRow> | undefined,
        spec.unitPrice,
      ),
    ]),
  ) as Pick<ReportData["ibTickets"], IbTicketRowKey>;

  const totals = ib
    ? {
        totalCount: coerceNum(ib.totalCount),
        totalAmount: coerceNum(ib.totalAmount),
      }
    : computeIbTicketTotals(rows);

  return { ...rows, ...totals };
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
    snsPost: snsPostWithDefaults(raw.snsPost),
    lostAndFound: typeof raw.lostAndFound === "string" ? raw.lostAndFound : "",
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
    policyMeasures: policyMeasuresWithDefaults(raw.policyMeasures),
    retail: {
      salesTaxEx: coerceNum(r?.salesTaxEx),
      salesTaxIn: coerceNum(r?.salesTaxIn),
      paymentCount: coerceNum(r?.paymentCount),
    },
    jerseyRental: jerseyRentalWithDefaults(raw.jerseyRental),
    ibTickets: ibTicketsWithDefaults(raw.ibTickets),
  };
}
