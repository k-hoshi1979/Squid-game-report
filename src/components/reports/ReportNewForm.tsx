"use client";

import { useRef, useState, useMemo, useTransition } from "react";
import { CsvTicketImporter } from "./CsvTicketImporter";
import type { CsvParseResult } from "@/lib/csv/parseTicketCsv";
import {
  type ReportData,
  type IbTicketRowKey,
  IB_TICKET_FORM_SPECS,
  IB_TICKET_ROW_KEYS,
  computeIbTicketTotals,
  ibTicketsWithDefaults,
  jerseyRentalWithDefaults,
  policyMeasuresWithDefaults,
  snsPostWithDefaults,
  JERSEY_RENTAL_UNIT_NORMAL,
  JERSEY_RENTAL_UNIT_SNS,
} from "@/types/report";
import type { RetailReportPrefill } from "@/lib/retail/prefillReport";
import {
  retailMdSalesExcludingIbTickets,
  taxExFromTaxIn,
  ticketTotalTaxEx,
} from "@/lib/tax";

/** ReportData.csv を CsvParseResult 互換の形式に変換する（旧データ groups なし対応）*/
function reportCsvToParseResult(csv: NonNullable<ReportData["csv"]>): CsvParseResult {
  return {
    eventName:    csv.eventName,
    venue:        csv.venue,
    datetimes:    csv.datetimes,
    groups:       (csv.groups ?? []) as CsvParseResult["groups"],
    rows:         (csv.rows   ?? []) as CsvParseResult["rows"],
    totalCount:   csv.totalCount,
    totalAmount:  csv.totalAmount,
  };
}

// ─── 固定単価 ────────────────────────────────────────────
const TOKUTEN_PRICE = 14000;
const VIP_PRICE     = 2000;
// ─── ユーティリティ ──────────────────────────────────────
const toNum = (v?: string | null) =>
  parseInt((v ?? "").replace(/,/g, ""), 10) || 0;
const fmt = (n: number) =>
  new Intl.NumberFormat("ja-JP").format(Math.round(n));
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const fmtDateJa = (d: string) => {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric", month: "long", day: "numeric", weekday: "long",
    }).format(new Date(d + "T00:00:00"));
  } catch { return d; }
};

// ─── 確定済み状態の型 ─────────────────────────────────────
interface TokutenState  { prev: number; today: number; sales: number; amount: number; done: boolean }
interface VipState      { prev: number; today: number; sales: number; amount: number; done: boolean }
interface RetailState   { taxEx: number; taxIn: number; payCount: number; done: boolean }
interface PolicyMeasuresState {
  game500CouponCollected: number;
  serialCardDistributed: number;
  mealDiscountDistributed: number;
  done: boolean;
}
/** ジャージレンタル（リテール合計とは別計上） */
interface JerseyState {
  normalCount: number;
  snsCount: number;
  subtotalNormal: number;
  subtotalSns: number;
  totalAmount: number;
  done: boolean;
}
type IbState = Record<IbTicketRowKey, number> & {
  totalCount: number;
  totalAmount: number;
  done: boolean;
};

function ibCountsFromRows(ib: ReportData["ibTickets"]): Record<IbTicketRowKey, number> {
  return Object.fromEntries(
    IB_TICKET_ROW_KEYS.map((key) => [key, ib[key].count]),
  ) as Record<IbTicketRowKey, number>;
}

function ibTicketsPayloadFromCounts(
  counts: Record<IbTicketRowKey, number>,
): ReportData["ibTickets"] {
  const rows = Object.fromEntries(
    IB_TICKET_FORM_SPECS.map((spec) => [
      spec.key,
      {
        count: counts[spec.key],
        unitPrice: spec.unitPrice,
        amount: counts[spec.key] * spec.unitPrice,
      },
    ]),
  ) as Pick<ReportData["ibTickets"], IbTicketRowKey>;
  return { ...rows, ...computeIbTicketTotals(rows) };
}

// ─── 小部品 ──────────────────────────────────────────────
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-[var(--muted)] border-b border-[var(--border)]">
        <h2 className="text-sm font-bold text-[var(--foreground)]">{title}</h2>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </div>
  );
}

function NumInput({ label, inputRef, unit = "枚", defaultValue = "" }: {
  label: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  unit?: string;
  defaultValue?: string | number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-[var(--foreground)] w-28 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          ref={inputRef}
          type="number"
          min="0"
          defaultValue={defaultValue}
          placeholder="0"
          className="w-28 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-right tabular-nums"
        />
        <span className="text-sm text-[var(--muted-foreground)]">{unit}</span>
      </div>
    </div>
  );
}

function OkButton({ onClick, done }: { onClick: () => void; done: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
        done
          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-300"
          : "bg-[var(--primary)] text-white hover:bg-blue-600 active:scale-95"
      }`}
    >
      {done ? (
        <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>確定済み（再確定）</>
      ) : "確　定"}
    </button>
  );
}

function ResultBox({ rows }: { rows: { label: string; value: string; highlight?: boolean }[] }) {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-700 rounded-lg px-4 py-2.5 space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex justify-between items-baseline">
          <span className="text-sm text-[var(--muted-foreground)]">{r.label}</span>
          <span className={`text-sm font-bold ${r.highlight ? "text-[var(--primary)] text-base" : "text-[var(--foreground)]"}`}>
            {r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── メインコンポーネント ────────────────────────────────
export function ReportNewForm({
  action,
  error,
  initialData,
  isEdit = false,
  defaultReportDate,
  prevDayValues,
  retailPrefill,
}: {
  action: (fd: FormData) => Promise<void>;
  error?: string;
  initialData?: ReportData;
  isEdit?: boolean;
  defaultReportDate?: string;
  prevDayValues?: { tokutenPrev: number; vipPrev: number; reportDate: string };
  retailPrefill?: RetailReportPrefill;
}) {
  const [isPending, startTransition] = useTransition();

  const initialIbRows = initialData
    ? ibTicketsWithDefaults(initialData.ibTickets)
    : retailPrefill
      ? ibTicketsWithDefaults(retailPrefill.ibTickets)
      : null;

  // 基本情報
  const [date, setDate]         = useState(
    initialData?.date ?? defaultReportDate ?? todayStr(),
  );
  const [reporter, setReporter] = useState(initialData?.reporter ?? "");

  // CSV
  const [csvData, setCsvData]               = useState<CsvParseResult | null>(
    initialData?.csv ? reportCsvToParseResult(initialData.csv) : null
  );
  const [showCsvImporter, setShowCsvImporter] = useState(false);

  // 確定済み状態（編集時は初期値をセット）
  const [tokuten, setTokuten] = useState<TokutenState>(
    initialData
      ? {
          prev:   initialData.tokuten?.prevRemaining   ?? 0,
          today:  initialData.tokuten?.todayRemaining ?? 0,
          sales:  initialData.tokuten?.salesCount     ?? 0,
          amount: initialData.tokuten?.amount         ?? 0,
          done:   true,
        }
      : { prev: 0, today: 0, sales: 0, amount: 0, done: false }
  );
  const [vip, setVip] = useState<VipState>(
    initialData
      ? {
          prev:   initialData.kashikiriVip?.prevTotal    ?? 0,
          today:  initialData.kashikiriVip?.todayTotal  ?? 0,
          sales:  initialData.kashikiriVip?.salesCount   ?? 0,
          amount: initialData.kashikiriVip?.amount       ?? 0,
          done:   true,
        }
      : { prev: 0, today: 0, sales: 0, amount: 0, done: false }
  );
  const [policyMeasures, setPolicyMeasures] = useState<PolicyMeasuresState>(
    initialData
      ? {
          game500CouponCollected: initialData.policyMeasures?.game500CouponCollected ?? 0,
          serialCardDistributed: initialData.policyMeasures?.serialCardDistributed ?? 0,
          mealDiscountDistributed: initialData.policyMeasures?.mealDiscountDistributed ?? 0,
          done: true,
        }
      : { game500CouponCollected: 0, serialCardDistributed: 0, mealDiscountDistributed: 0, done: false },
  );

  const [retail, setRetail] = useState<RetailState>(
    initialData
      ? {
          taxEx:    initialData.retail?.salesTaxEx    ?? 0,
          taxIn:    initialData.retail?.salesTaxIn    ?? 0,
          payCount: initialData.retail?.paymentCount ?? 0,
          done: true,
        }
      : { taxEx: 0, taxIn: 0, payCount: 0, done: false }
  );
  const [jersey, setJersey] = useState<JerseyState>(() => {
    if (initialData) {
      const j = jerseyRentalWithDefaults(initialData.jerseyRental);
      return {
        normalCount: j.normalCount,
        snsCount: j.snsCount,
        subtotalNormal: j.subtotalNormal,
        subtotalSns: j.subtotalSns,
        totalAmount: j.totalAmount,
        done: true,
      };
    }
    if (retailPrefill) {
      const j = jerseyRentalWithDefaults(retailPrefill.jerseyRental);
      return {
        normalCount: j.normalCount,
        snsCount: j.snsCount,
        subtotalNormal: j.subtotalNormal,
        subtotalSns: j.subtotalSns,
        totalAmount: j.totalAmount,
        done: false,
      };
    }
    return { normalCount: 0, snsCount: 0, subtotalNormal: 0, subtotalSns: 0, totalAmount: 0, done: false };
  });
  const [ibTickets, setIbTickets] = useState<IbState>(() => {
    if (initialData) {
      const ib = ibTicketsWithDefaults(initialData.ibTickets);
      return { ...ibCountsFromRows(ib), totalCount: ib.totalCount, totalAmount: ib.totalAmount, done: true };
    }
    if (retailPrefill) {
      const ib = ibTicketsWithDefaults(retailPrefill.ibTickets);
      return { ...ibCountsFromRows(ib), totalCount: ib.totalCount, totalAmount: ib.totalAmount, done: false };
    }
    const zero = Object.fromEntries(IB_TICKET_ROW_KEYS.map((k) => [k, 0])) as Record<IbTicketRowKey, number>;
    return { ...zero, totalCount: 0, totalAmount: 0, done: false };
  });

  // テキスト
  const [snsCircleCount, setSnsCircleCount] = useState(
    () =>
      initialData?.snsPost?.circleCount
      ?? retailPrefill?.snsPost.circleCount
      ?? 0,
  );
  const [snsSquareCount, setSnsSquareCount] = useState(
    () =>
      initialData?.snsPost?.squareCount
      ?? retailPrefill?.snsPost.squareCount
      ?? 0,
  );
  const [operationNotes,  setOperationNotes]  = useState(initialData?.operationNotes ?? "");
  const [irregularReport, setIrregularReport] = useState(initialData?.irregularReport ?? "");
  const [lostAndFound, setLostAndFound] = useState(initialData?.lostAndFound ?? "");

  // refs（uncontrolled inputs）
  const tokutenPrevRef    = useRef<HTMLInputElement>(null);
  const tokutenTodayRef   = useRef<HTMLInputElement>(null);
  const vipPrevRef        = useRef<HTMLInputElement>(null);
  const vipTodayRef       = useRef<HTMLInputElement>(null);
  const policyGame500Ref  = useRef<HTMLInputElement>(null);
  const policySerialRef   = useRef<HTMLInputElement>(null);
  const policyMealRef     = useRef<HTMLInputElement>(null);
  const retailSalesRef    = useRef<HTMLInputElement>(null);
  const retailSalesTaxInRef = useRef<HTMLInputElement>(null);
  const payCountRef       = useRef<HTMLInputElement>(null);
  const jerseyNormalRef   = useRef<HTMLInputElement>(null);
  const jerseySnsRef      = useRef<HTMLInputElement>(null);
  const ibInputRefs = useRef<Partial<Record<IbTicketRowKey, HTMLInputElement | null>>>({});

  // ─── 確定ハンドラ ────────────────────────────────────
  const confirmTokuten = () => {
    const prev  = toNum(tokutenPrevRef.current?.value);
    const today = toNum(tokutenTodayRef.current?.value);
    const sales = Math.max(0, prev - today);
    setTokuten({ prev, today, sales, amount: sales * TOKUTEN_PRICE, done: true });
  };

  const confirmVip = () => {
    const prev  = toNum(vipPrevRef.current?.value);
    const today = toNum(vipTodayRef.current?.value);
    const sales = Math.max(0, today - prev);
    setVip({ prev, today, sales, amount: sales * VIP_PRICE, done: true });
  };

  const confirmPolicyMeasures = () => {
    setPolicyMeasures({
      game500CouponCollected: toNum(policyGame500Ref.current?.value),
      serialCardDistributed: toNum(policySerialRef.current?.value),
      mealDiscountDistributed: toNum(policyMealRef.current?.value),
      done: true,
    });
  };

  const confirmRetail = () => {
    const taxEx    = toNum(retailSalesRef.current?.value);
    const taxIn    = toNum(retailSalesTaxInRef.current?.value);
    const payCount = toNum(payCountRef.current?.value);
    setRetail({ taxEx, taxIn, payCount, done: true });
  };

  const confirmJersey = () => {
    const n = toNum(jerseyNormalRef.current?.value);
    const s = toNum(jerseySnsRef.current?.value);
    const subN = n * JERSEY_RENTAL_UNIT_NORMAL;
    const subS = s * JERSEY_RENTAL_UNIT_SNS;
    setJersey({
      normalCount: n,
      snsCount: s,
      subtotalNormal: subN,
      subtotalSns: subS,
      totalAmount: subN + subS,
      done: true,
    });
  };

  const confirmIb = () => {
    const counts = Object.fromEntries(
      IB_TICKET_ROW_KEYS.map((key) => [
        key,
        toNum(ibInputRefs.current[key]?.value),
      ]),
    ) as Record<IbTicketRowKey, number>;
    const payload = ibTicketsPayloadFromCounts(counts);
    setIbTickets({
      ...counts,
      totalCount: payload.totalCount,
      totalAmount: payload.totalAmount,
      done: true,
    });
  };

  // チケット合計
  const retailMdSales = useMemo(
    () => retailMdSalesExcludingIbTickets(retail.taxIn, ibTickets.totalAmount),
    [retail.taxIn, ibTickets.totalAmount],
  );

  const ticketTotal = useMemo(() => {
    const taxIn = (csvData?.totalAmount ?? 0) + tokuten.amount + vip.amount;
    return {
      count:       (csvData?.totalCount ?? 0) + tokuten.sales + vip.sales,
      amountTaxIn: taxIn,
      amountTaxEx: taxExFromTaxIn(taxIn),
    };
  }, [csvData, tokuten, vip]);

  // レポートデータ
  const snsPost = useMemo(
    () => snsPostWithDefaults({ circleCount: snsCircleCount, squareCount: snsSquareCount }),
    [snsCircleCount, snsSquareCount],
  );

  const reportData: ReportData = useMemo(() => ({
    version: 1, date, reporter,
    csv: csvData ? { eventName: csvData.eventName, venue: csvData.venue, datetimes: csvData.datetimes, groups: csvData.groups, rows: csvData.rows, totalCount: csvData.totalCount, totalAmount: csvData.totalAmount } : null,
    tokuten: { prevRemaining: tokuten.prev, todayRemaining: tokuten.today, salesCount: tokuten.sales, unitPrice: TOKUTEN_PRICE, amount: tokuten.amount },
    kashikiriVip: { prevTotal: vip.prev, todayTotal: vip.today, salesCount: vip.sales, unitPrice: VIP_PRICE, amount: vip.amount },
    ticketTotal,
    policyMeasures: policyMeasuresWithDefaults({
      game500CouponCollected: policyMeasures.game500CouponCollected,
      serialCardDistributed: policyMeasures.serialCardDistributed,
      mealDiscountDistributed: policyMeasures.mealDiscountDistributed,
    }),
    retail: { salesTaxEx: retail.taxEx, salesTaxIn: retail.taxIn, paymentCount: retail.payCount },
    jerseyRental: jerseyRentalWithDefaults({ normalCount: jersey.normalCount, snsCount: jersey.snsCount }),
    ibTickets: ibTicketsPayloadFromCounts(
      Object.fromEntries(IB_TICKET_ROW_KEYS.map((k) => [k, ibTickets[k]])) as Record<
        IbTicketRowKey,
        number
      >,
    ),
    operationNotes, irregularReport,
    snsPost,
    lostAndFound,
  }), [date, reporter, csvData, tokuten, vip, ticketTotal, policyMeasures, retail, jersey, ibTickets, snsPost, operationNotes, irregularReport, lostAndFound]);

  // ─── 送信ハンドラ（formなし・useTransition） ──────────
  /** 入力欄が uncontrolled のため、保存直前は ref の現値で上書き（確定ボタンを押し忘れても反映される） */
  const handleSubmit = (submitAction: "draft" | "submit") => {
    const policyMeasuresPayload = policyMeasuresWithDefaults({
      game500CouponCollected: toNum(policyGame500Ref.current?.value),
      serialCardDistributed: toNum(policySerialRef.current?.value),
      mealDiscountDistributed: toNum(policyMealRef.current?.value),
    });
    const retailPayload: ReportData["retail"] = {
      salesTaxEx: toNum(retailSalesRef.current?.value),
      salesTaxIn: toNum(retailSalesTaxInRef.current?.value),
      paymentCount: toNum(payCountRef.current?.value),
    };
    const jerseyPayload = jerseyRentalWithDefaults({
      normalCount: toNum(jerseyNormalRef.current?.value),
      snsCount: toNum(jerseySnsRef.current?.value),
    });
    const ibCounts = Object.fromEntries(
      IB_TICKET_ROW_KEYS.map((key) => [key, toNum(ibInputRefs.current[key]?.value)]),
    ) as Record<IbTicketRowKey, number>;
    const ibTicketsPayload = ibTicketsPayloadFromCounts(ibCounts);

    const fd = new FormData();
    fd.set("report_date", date);
    fd.set("title", `${date} 日報${reporter ? ` (${reporter})` : ""}`);
    fd.set(
      "content",
      JSON.stringify({
        ...reportData,
        policyMeasures: policyMeasuresPayload,
        retail: retailPayload,
        jerseyRental: jerseyPayload,
        ibTickets: ibTicketsPayload,
      }),
    );
    fd.set("action", submitAction);
    startTransition(async () => { await action(fd); });
  };

  // ─── レンダリング ─────────────────────────────────────
  return (
    <div className="space-y-5">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {decodeURIComponent(error)}
        </div>
      )}

      {!isEdit && retailPrefill && (
        <div className="px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800 dark:bg-blue-900/20 dark:border-blue-800 dark:text-blue-200">
          RETAIL業務アプリの当日データ（ジャージレンタル・IBチケット・SNS投稿）を取り込みました
        </div>
      )}

      {/* ── 基本情報 ── */}
      <Card title="基本情報">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
              日付 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              defaultValue={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">報告者</label>
            <input
              type="text"
              value={reporter}
              onChange={(e) => setReporter(e.target.value)}
              placeholder="山田 太郎"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>
      </Card>

      {/* ── ■チケット販売 ── */}
      <Card title="■ チケット販売">
        {/* CSV */}
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setShowCsvImporter((v) => !v)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors border ${
                showCsvImporter
                  ? "bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-700"
                  : "border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
              }`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              チケットCSV取り込み
              {csvData && (
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-xs font-semibold dark:bg-green-900/20 dark:text-green-400">
                  ✓ {fmt(csvData.totalCount)}枚
                </span>
              )}
            </button>
          </div>
          {showCsvImporter && (
            <CsvTicketImporter
              onInsert={() => {}}
              onData={(data) => { setCsvData(data); setShowCsvImporter(false); }}
            />
          )}
          {csvData && !showCsvImporter && (
            <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg px-3 py-2 text-xs space-y-1">
              <p className="font-semibold text-green-800 dark:text-green-300">{csvData.eventName}</p>
              {(csvData.groups ?? []).map((group) => (
                <div key={group.receptionName}>
                  <p className="font-bold text-[var(--muted-foreground)] mt-1">▸ {group.receptionName}</p>
                  {group.rows.map((r) => (
                    <p key={r.ticketType} className="pl-3 text-[var(--muted-foreground)]">
                      {r.ticketType}：{fmt(r.count)}枚{r.amount > 0 ? ` ¥${fmt(r.amount)}` : ""}
                    </p>
                  ))}
                  <p className="pl-3 text-green-700 dark:text-green-400">
                    小計：{fmt(group.subtotalCount)}枚 / ¥{fmt(group.subtotalAmount)}
                  </p>
                </div>
              ))}
              <p className="font-bold text-green-800 dark:text-green-300 pt-0.5 border-t border-green-200 dark:border-green-800 mt-1">
                CSV合計：{fmt(csvData.totalCount)}枚 / ¥{fmt(csvData.totalAmount)}
              </p>
            </div>
          )}
        </div>

        <hr className="border-[var(--border)]" />

        {/* 特典残数 */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">特典残数</p>
              <p className="text-xs text-[var(--muted-foreground)]">前日残数 − 当日残数 ＝ 当日販売数　単価 ¥{fmt(TOKUTEN_PRICE)}（固定）</p>
            </div>
            <OkButton onClick={confirmTokuten} done={tokuten.done} />
          </div>
          {!isEdit && prevDayValues && (
            <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded px-2 py-1">
              📋 {prevDayValues.reportDate} の日報から前日残数を自動入力しました
            </p>
          )}
          <div className="space-y-2 pl-1">
            <NumInput
              label="前日残数"
              inputRef={tokutenPrevRef}
              defaultValue={initialData?.tokuten.prevRemaining ?? prevDayValues?.tokutenPrev ?? ""}
            />
            <NumInput label="当日残数" inputRef={tokutenTodayRef} defaultValue={initialData?.tokuten.todayRemaining ?? ""} />
          </div>
          {tokuten.done && (
            <ResultBox rows={[
              { label: "当日販売数", value: `${fmt(tokuten.sales)} 枚` },
              { label: "小計", value: `¥${fmt(tokuten.amount)}`, highlight: true },
            ]} />
          )}
        </div>

        <hr className="border-[var(--border)]" />

        {/* 貸切VIP */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">貸切VIP</p>
              <p className="text-xs text-[var(--muted-foreground)]">本日累計 − 前日累計 ＝ 当日販売数　単価 ¥{fmt(VIP_PRICE)}（固定）</p>
            </div>
            <OkButton onClick={confirmVip} done={vip.done} />
          </div>
          {!isEdit && prevDayValues && (
            <p className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded px-2 py-1">
              📋 {prevDayValues.reportDate} の日報から前日累計を自動入力しました
            </p>
          )}
          <div className="space-y-2 pl-1">
            <NumInput
              label="前日累計"
              inputRef={vipPrevRef}
              defaultValue={initialData?.kashikiriVip.prevTotal ?? prevDayValues?.vipPrev ?? ""}
            />
            <NumInput label="本日累計" inputRef={vipTodayRef} defaultValue={initialData?.kashikiriVip.todayTotal ?? ""} />
          </div>
          {vip.done && (
            <ResultBox rows={[
              { label: "当日販売数", value: `${fmt(vip.sales)} 枚` },
              { label: "小計", value: `¥${fmt(vip.amount)}`, highlight: true },
            ]} />
          )}
        </div>

        {/* チケット合計バナー */}
        {(csvData || tokuten.done || vip.done) && (
          <div className="bg-[var(--primary)]/8 border-2 border-[var(--primary)]/30 rounded-lg px-4 py-3 space-y-1.5">
            <p className="text-xs font-bold text-[var(--primary)]">── チケット合計 ──</p>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">合計枚数</span>
              <span className="font-bold">{fmt(ticketTotal.count)} 枚</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">売上合計（税込）</span>
              <span className="font-bold text-[var(--primary)] text-base">¥{fmt(ticketTotal.amountTaxIn)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-[var(--muted-foreground)]">売上合計（税抜）</span>
              <span className="font-semibold">¥{fmt(ticketTotalTaxEx(ticketTotal))}</span>
            </div>
          </div>
        )}
      </Card>

      {/* ── ■施策対応 ── */}
      <Card title="■ 施策対応">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-[var(--muted-foreground)]">各項目の数量を入力してください。</p>
          <OkButton onClick={confirmPolicyMeasures} done={policyMeasures.done} />
        </div>
        <div className="space-y-2 pl-1">
          <NumInput
            label="①イカゲーム500円引き券回収"
            inputRef={policyGame500Ref}
            unit="枚"
            defaultValue={initialData?.policyMeasures?.game500CouponCollected ?? ""}
          />
          <NumInput
            label="②シリアルカード配布"
            inputRef={policySerialRef}
            unit="枚"
            defaultValue={initialData?.policyMeasures?.serialCardDistributed ?? ""}
          />
          <NumInput
            label="③お食事割引券配布"
            inputRef={policyMealRef}
            unit="枚"
            defaultValue={initialData?.policyMeasures?.mealDiscountDistributed ?? ""}
          />
        </div>
        {policyMeasures.done && (
          <ResultBox
            rows={[
              {
                label: "①イカゲーム500円引き券回収",
                value: `${fmt(policyMeasures.game500CouponCollected)} 枚`,
              },
              {
                label: "②シリアルカード配布",
                value: `${fmt(policyMeasures.serialCardDistributed)} 枚`,
              },
              {
                label: "③お食事割引券配布",
                value: `${fmt(policyMeasures.mealDiscountDistributed)} 枚`,
              },
            ]}
          />
        )}
      </Card>

      {/* ── ■リテール販売 ── */}
      <Card title="■ リテール販売">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-[var(--muted-foreground)]">物販売り上げ（税抜・税込）はそれぞれ手入力してください。</p>
          <OkButton onClick={confirmRetail} done={retail.done} />
        </div>
        <div className="space-y-2 pl-1">
          <div className="flex items-center gap-3">
            <label htmlFor="retail_sales_tax_ex" className="text-sm text-[var(--foreground)] w-40 shrink-0">
              物販売り上げ（税抜）
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-[var(--muted-foreground)]">¥</span>
              <input
                id="retail_sales_tax_ex"
                name="retail_sales_tax_ex"
                ref={retailSalesRef}
                type="number"
                min="0"
                defaultValue={initialData?.retail?.salesTaxEx ?? ""}
                placeholder="0"
                className="w-32 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-right tabular-nums"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label htmlFor="retail_sales_tax_in" className="text-sm text-[var(--foreground)] w-40 shrink-0">
              物販売り上げ（税込）
            </label>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-[var(--muted-foreground)]">¥</span>
              <input
                id="retail_sales_tax_in"
                name="retail_sales_tax_in"
                ref={retailSalesTaxInRef}
                type="number"
                min="0"
                defaultValue={initialData?.retail?.salesTaxIn ?? ""}
                placeholder="0"
                className="w-32 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-right tabular-nums"
              />
            </div>
          </div>
          <NumInput label="決済件数" inputRef={payCountRef} unit="件" defaultValue={initialData?.retail?.paymentCount ?? ""} />
        </div>
        {retail.done && (
          <ResultBox rows={[
            { label: "物販（税抜）", value: `¥${fmt(retail.taxEx)}` },
            { label: "物販（税込）", value: `¥${fmt(Math.round(retail.taxIn))}`, highlight: true },
            { label: "決済件数", value: `${fmt(retail.payCount)} 件` },
            {
              label: "チケット売上を除くMD売上",
              value: `¥${fmt(retailMdSales)}`,
              highlight: true,
            },
          ]} />
        )}
        <p className="text-xs text-[var(--muted-foreground)] pl-1">
          チケット売上を除くMD売上 ＝ リテール売上合計（税込）− IBチケット対応合計（税抜）
        </p>
      </Card>

      {/* ── ■ジャージレンタル（リテール合計とは別計上） ── */}
      <Card title="■ ジャージレンタル">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="text-xs text-[var(--muted-foreground)]">各項目の数量を入力してください。レンタル合計 ＝ 小計① ＋ 小計②</p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1 font-medium">
              ※この金額はリテール売上合計には含みません。
            </p>
          </div>
          <OkButton onClick={confirmJersey} done={jersey.done} />
        </div>
        <div className="space-y-2 pl-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-[var(--foreground)] w-44 shrink-0">ジャージレンタル通常</span>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={jerseyNormalRef}
                type="number"
                min="0"
                defaultValue={jersey.normalCount || ""}
                placeholder="0"
                className="w-24 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-right tabular-nums"
              />
              <span className="text-xs text-[var(--muted-foreground)]">×　¥{fmt(JERSEY_RENTAL_UNIT_NORMAL)}　＝　小計金額①</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-[var(--foreground)] w-44 shrink-0">ジャージレンタル SNS</span>
            <div className="flex items-center gap-2 flex-wrap">
              <input
                ref={jerseySnsRef}
                type="number"
                min="0"
                defaultValue={jersey.snsCount || ""}
                placeholder="0"
                className="w-24 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-right tabular-nums"
              />
              <span className="text-xs text-[var(--muted-foreground)]">×　¥{fmt(JERSEY_RENTAL_UNIT_SNS)}　＝　小計金額②</span>
            </div>
          </div>
        </div>
        {jersey.done && (
          <ResultBox rows={[
            { label: "小計金額①（通常）", value: `¥${fmt(jersey.subtotalNormal)}` },
            { label: "小計金額②（SNS）", value: `¥${fmt(jersey.subtotalSns)}` },
            { label: "レンタル合計（①＋②）", value: `¥${fmt(jersey.totalAmount)}`, highlight: true },
          ]} />
        )}
      </Card>

      {/* ── ■IB対応チケット ── */}
      <Card title="■ IB対応チケット">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-[var(--muted-foreground)]">各券種の枚数を入力してください</p>
          <OkButton onClick={confirmIb} done={ibTickets.done} />
        </div>
        <div className="space-y-2 pl-1">
          {IB_TICKET_FORM_SPECS.map((spec) => (
            <div key={spec.key} className="flex items-center gap-3">
              <span className={`text-sm text-[var(--foreground)] shrink-0 ${spec.label.startsWith("【500円引き】") ? "w-44" : "w-36"}`}>
                {spec.label}
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={(el) => {
                    ibInputRefs.current[spec.key] = el;
                  }}
                  type="number"
                  min="0"
                  defaultValue={initialIbRows?.[spec.key].count ?? ""}
                  placeholder="0"
                  className="w-20 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-right tabular-nums"
                />
                <span className="text-xs text-[var(--muted-foreground)]">枚 × ¥{fmt(spec.unitPrice)}</span>
              </div>
            </div>
          ))}
        </div>
        {ibTickets.done && (
          <ResultBox
            rows={[
              ...IB_TICKET_FORM_SPECS.map((spec) => ({
                label: spec.label,
                value: `${fmt(ibTickets[spec.key])}枚  ¥${fmt(ibTickets[spec.key] * spec.unitPrice)}`,
              })),
              {
                label: "IB合計",
                value: `${fmt(ibTickets.totalCount)}枚 / ¥${fmt(ibTickets.totalAmount)}`,
                highlight: true,
              },
            ]}
          />
        )}
      </Card>

      {/* ── SNS投稿 ── */}
      <Card title="■ SNS投稿">
        <div className="space-y-3 pl-1">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-[var(--foreground)] w-16 shrink-0">〇</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                value={snsCircleCount || ""}
                onChange={(e) => setSnsCircleCount(toNum(e.target.value))}
                placeholder="0"
                className="w-24 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-right tabular-nums"
              />
              <span className="text-xs text-[var(--muted-foreground)]">枚</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-[var(--foreground)] w-16 shrink-0">▢</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min="0"
                value={snsSquareCount || ""}
                onChange={(e) => setSnsSquareCount(toNum(e.target.value))}
                placeholder="0"
                className="w-24 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-right tabular-nums"
              />
              <span className="text-xs text-[var(--muted-foreground)]">枚</span>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-[var(--border)]/60">
            <span className="text-sm font-medium text-[var(--foreground)] w-16 shrink-0">合計</span>
            <span className="text-sm font-bold text-[var(--primary)] tabular-nums">
              {fmt(snsPost.totalCount)}枚
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">（〇＋▢）</span>
          </div>
        </div>
      </Card>

      {/* ── 運営所感 / イレギュラー報告 ── */}
      <Card title="■ 運営所感 / イレギュラー報告">
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">運営所感</label>
            <textarea
              rows={4} value={operationNotes} onChange={(e) => setOperationNotes(e.target.value)}
              placeholder="本日の運営状況・気づきを記入してください"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--foreground)] mb-1.5">イレギュラー報告</label>
            <textarea
              rows={3} value={irregularReport} onChange={(e) => setIrregularReport(e.target.value)}
              placeholder="不具合・お客様対応などがあれば記入してください"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
            />
          </div>
        </div>
      </Card>

      {/* ── 落とし物取得 ── */}
      <Card title="■ 落とし物取得">
        <textarea
          rows={3}
          value={lostAndFound}
          onChange={(e) => setLostAndFound(e.target.value)}
          placeholder="落とし物の内容を記入してください"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
        />
      </Card>

      {/* ── 報告書プレビュー ── */}
      <div className="bg-[var(--card)] border-2 border-dashed border-[var(--primary)]/40 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-blue-50/60 dark:bg-blue-900/10 border-b border-[var(--primary)]/20">
          <h2 className="text-sm font-bold text-[var(--primary)]">
            報告書プレビュー（確定済み項目が反映されます）
          </h2>
        </div>
        <div className="p-5">
          <ReportPreview data={reportData} />
        </div>
      </div>

      {/* ── 送信ボタン（formなし・useTransition） ── */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSubmit("draft")}
          className="px-5 py-2.5 border border-[var(--border)] text-[var(--foreground)] text-sm font-medium rounded-lg hover:bg-[var(--muted)] active:scale-95 transition-all disabled:opacity-50"
        >
          {isPending ? "保存中..." : isEdit ? "下書きとして更新" : "下書き保存"}
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => handleSubmit("submit")}
          className="px-6 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50"
        >
          {isPending ? "更新中..." : isEdit ? "提出として更新" : "提出する"}
        </button>
      </div>
    </div>
  );
}

// ─── 報告書プレビュー ────────────────────────────────────
function PRow({ label, value, sub, bold }: { label: string; value: string; sub?: string; bold?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between py-1 border-b border-[var(--border)]/40 last:border-0 ${bold ? "font-bold" : ""}`}>
      <span className="text-sm text-[var(--muted-foreground)]">{label}</span>
      <div className="text-right">
        <span className={`text-sm ${bold ? "text-[var(--primary)]" : "text-[var(--foreground)]"}`}>{value}</span>
        {sub && <span className="ml-2 text-xs text-[var(--muted-foreground)]">{sub}</span>}
      </div>
    </div>
  );
}

function PBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider pb-1">{title}</p>
      <div className="bg-[var(--background)] border border-[var(--border)] rounded-lg px-3 py-1">{children}</div>
    </div>
  );
}

function ReportPreview({ data }: { data: ReportData }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-base font-bold text-[var(--foreground)]">
          {fmtDateJa(data.date) || "（日付未入力）"}
        </p>
        <p className="text-sm text-[var(--muted-foreground)]">
          報告者: {data.reporter || "（未入力）"}
        </p>
      </div>

      <PBlock title="■ チケット売上">
        {data.csv ? (
          <>
            <p className="text-xs font-semibold text-[var(--muted-foreground)] pt-1 pb-0.5">{data.csv.eventName}</p>
            {/* 受付名グループ別表示 */}
            {(data.csv.groups ?? []).map((group) => (
              <div key={group.receptionName} className="mb-1">
                <p className="text-xs font-bold text-[var(--muted-foreground)] mt-1.5 mb-0.5 pl-0.5">▸ {group.receptionName}</p>
                {group.rows.map((r) => (
                  <PRow
                    key={r.ticketType}
                    label={`　${r.ticketType}`}
                    value={`${fmt(r.count)}枚`}
                    sub={r.amount > 0 ? `¥${fmt(r.amount)}` : undefined}
                  />
                ))}
                <PRow label="　小計" value={`${fmt(group.subtotalCount)}枚`} sub={`¥${fmt(group.subtotalAmount)}`} />
              </div>
            ))}
            <PRow label="CSV合計" value={`${fmt(data.csv.totalCount)}枚`} sub={`¥${fmt(data.csv.totalAmount)}`} bold />
          </>
        ) : <p className="text-xs text-[var(--muted-foreground)] py-1.5">CSV未取込</p>}
        <PRow label="特典残数（当日販売）" value={`${fmt(data.tokuten.salesCount)}枚`} sub={`¥${fmt(data.tokuten.amount)}`} />
        <PRow label="貸切VIP（当日販売）" value={`${fmt(data.kashikiriVip.salesCount)}枚`} sub={`¥${fmt(data.kashikiriVip.amount)}`} />
        <PRow label="合計枚数" value={`${fmt(data.ticketTotal.count)}枚`} bold />
        <PRow label="売上合計（税込）" value={`¥${fmt(data.ticketTotal.amountTaxIn)}`} bold />
        <PRow label="売上合計（税抜）" value={`¥${fmt(ticketTotalTaxEx(data.ticketTotal))}`} />
      </PBlock>

      <PBlock title="■ 施策対応">
        {(() => {
          const pm = policyMeasuresWithDefaults(data.policyMeasures);
          return (
            <>
              <PRow label="①イカゲーム500円引き券回収" value={`${fmt(pm.game500CouponCollected)}枚`} />
              <PRow label="②シリアルカード配布" value={`${fmt(pm.serialCardDistributed)}枚`} />
              <PRow label="③お食事割引券配布" value={`${fmt(pm.mealDiscountDistributed)}枚`} />
            </>
          );
        })()}
      </PBlock>

      <PBlock title="■ リテール売上">
        <PRow label="物販（税抜）"  value={`¥${fmt(data.retail.salesTaxEx)}`} />
        <PRow label="物販（税込）"  value={`¥${fmt(Math.round(data.retail.salesTaxIn))}`} bold />
        <PRow label="決済件数"      value={`${fmt(data.retail.paymentCount)}件`} />
        <PRow
          label="チケット売上を除くMD売上"
          value={`¥${fmt(retailMdSalesExcludingIbTickets(
            data.retail.salesTaxIn,
            ibTicketsWithDefaults(data.ibTickets).totalAmount,
          ))}`}
          bold
        />
      </PBlock>

      <PBlock title="■ ジャージレンタル">
        {(() => {
          const jr = jerseyRentalWithDefaults(data.jerseyRental);
          return (
            <>
              <PRow label="通常（×¥1,500）" value={`${fmt(jr.normalCount)}着`} sub={`¥${fmt(jr.subtotalNormal)}`} />
              <PRow label="SNS（×¥1,000）" value={`${fmt(jr.snsCount)}着`} sub={`¥${fmt(jr.subtotalSns)}`} />
              <PRow label="レンタル合計（リテール合計とは別計上）" value={`¥${fmt(jr.totalAmount)}`} bold />
            </>
          );
        })()}
      </PBlock>

      <PBlock title="■ IB対応チケット">
        {(() => {
          const ib = ibTicketsWithDefaults(data.ibTickets);
          return IB_TICKET_FORM_SPECS.map((spec) => {
            const r = ib[spec.key];
            return (
              <PRow
                key={spec.key}
                label={`${spec.label}（×¥${fmt(r.unitPrice)}）`}
                value={`${fmt(r.count)}枚`}
                sub={`¥${fmt(r.amount)}`}
              />
            );
          });
        })()}
        <PRow label="IB合計" value={`${fmt(data.ibTickets.totalCount)}枚`} sub={`¥${fmt(data.ibTickets.totalAmount)}`} bold />
      </PBlock>

      {(() => {
        const sns = snsPostWithDefaults(data.snsPost);
        return (
          (sns.circleCount > 0 || sns.squareCount > 0) && (
            <PBlock title="■ SNS投稿">
              <PRow label="〇" value={`${fmt(sns.circleCount)}枚`} />
              <PRow label="▢" value={`${fmt(sns.squareCount)}枚`} />
              <PRow label="合計" value={`${fmt(sns.totalCount)}枚`} bold />
            </PBlock>
          )
        );
      })()}

      {data.operationNotes && (
        <PBlock title="■ 運営所感">
          <p className="text-sm py-1.5 whitespace-pre-wrap">{data.operationNotes}</p>
        </PBlock>
      )}
      {data.irregularReport && (
        <PBlock title="■ イレギュラー報告">
          <p className="text-sm py-1.5 whitespace-pre-wrap">{data.irregularReport}</p>
        </PBlock>
      )}
      {data.lostAndFound && (
        <PBlock title="■ 落とし物取得">
          <p className="text-sm py-1.5 whitespace-pre-wrap">{data.lostAndFound}</p>
        </PBlock>
      )}
    </div>
  );
}
