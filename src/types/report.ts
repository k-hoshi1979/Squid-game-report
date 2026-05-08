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
    salesTaxEx: number; // 物販売り上げ（税抜き・入力値）
    salesTaxIn: number; // 税込 = 税抜 × 1.1
    paymentCount: number;
  };

  /** IB対応チケット */
  ibTickets: {
    genWeekday:   IbTicketRow; // 一般（平日）  ¥4,230
    genHoliday:   IbTicketRow; // 一般（休日）  ¥4,430
    childWeekday: IbTicketRow; // こども（平日）¥3,630
    childHoliday: IbTicketRow; // こども（休日）¥3,830
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
