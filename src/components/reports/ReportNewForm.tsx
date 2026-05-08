"use client";

import { useRef, useState, useMemo, useTransition } from "react";
import { CsvTicketImporter } from "./CsvTicketImporter";
import type { CsvParseResult } from "@/lib/csv/parseTicketCsv";
import type { ReportData } from "@/types/report";

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
const IB_PRICES = {
  genWeekday:   4230,  // 3900 + 330
  genHoliday:   4430,  // 4100 + 330
  childWeekday: 3630,  // 3300 + 330
  childHoliday: 3830,  // 3500 + 330
  vip:          2330,  // 2000 + 330
} as const;

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
interface IbState {
  genWeekday: number; genHoliday: number; childWeekday: number;
  childHoliday: number; vip: number; totalCount: number; totalAmount: number; done: boolean;
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
  prevDayValues,
}: {
  action: (fd: FormData) => Promise<void>;
  error?: string;
  initialData?: ReportData;
  isEdit?: boolean;
  prevDayValues?: { tokutenPrev: number; vipPrev: number; reportDate: string };
}) {
  const [isPending, startTransition] = useTransition();

  // 基本情報
  const [date, setDate]         = useState(initialData?.date ?? todayStr());
  const [reporter, setReporter] = useState(initialData?.reporter ?? "");

  // CSV
  const [csvData, setCsvData]               = useState<CsvParseResult | null>(
    initialData?.csv ? reportCsvToParseResult(initialData.csv) : null
  );
  const [showCsvImporter, setShowCsvImporter] = useState(false);

  // 確定済み状態（編集時は初期値をセット）
  const [tokuten, setTokuten] = useState<TokutenState>(
    initialData
      ? { prev: initialData.tokuten.prevRemaining, today: initialData.tokuten.todayRemaining,
          sales: initialData.tokuten.salesCount, amount: initialData.tokuten.amount, done: true }
      : { prev: 0, today: 0, sales: 0, amount: 0, done: false }
  );
  const [vip, setVip] = useState<VipState>(
    initialData
      ? { prev: initialData.kashikiriVip.prevTotal, today: initialData.kashikiriVip.todayTotal,
          sales: initialData.kashikiriVip.salesCount, amount: initialData.kashikiriVip.amount, done: true }
      : { prev: 0, today: 0, sales: 0, amount: 0, done: false }
  );
  const [retail, setRetail] = useState<RetailState>(
    initialData
      ? { taxEx: initialData.retail.salesTaxEx, taxIn: initialData.retail.salesTaxIn,
          payCount: initialData.retail.paymentCount, done: true }
      : { taxEx: 0, taxIn: 0, payCount: 0, done: false }
  );
  const [ibTickets, setIbTickets] = useState<IbState>(
    initialData
      ? { genWeekday: initialData.ibTickets.genWeekday.count, genHoliday: initialData.ibTickets.genHoliday.count,
          childWeekday: initialData.ibTickets.childWeekday.count, childHoliday: initialData.ibTickets.childHoliday.count,
          vip: initialData.ibTickets.vip.count, totalCount: initialData.ibTickets.totalCount,
          totalAmount: initialData.ibTickets.totalAmount, done: true }
      : { genWeekday: 0, genHoliday: 0, childWeekday: 0, childHoliday: 0, vip: 0,
          totalCount: 0, totalAmount: 0, done: false }
  );

  // テキスト
  const [operationNotes,  setOperationNotes]  = useState(initialData?.operationNotes ?? "");
  const [irregularReport, setIrregularReport] = useState(initialData?.irregularReport ?? "");

  // refs（uncontrolled inputs）
  const tokutenPrevRef    = useRef<HTMLInputElement>(null);
  const tokutenTodayRef   = useRef<HTMLInputElement>(null);
  const vipPrevRef        = useRef<HTMLInputElement>(null);
  const vipTodayRef       = useRef<HTMLInputElement>(null);
  const retailSalesRef    = useRef<HTMLInputElement>(null);
  const payCountRef       = useRef<HTMLInputElement>(null);
  const ibGenWeekdayRef   = useRef<HTMLInputElement>(null);
  const ibGenHolidayRef   = useRef<HTMLInputElement>(null);
  const ibChildWeekdayRef = useRef<HTMLInputElement>(null);
  const ibChildHolidayRef = useRef<HTMLInputElement>(null);
  const ibVipRef          = useRef<HTMLInputElement>(null);

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

  const confirmRetail = () => {
    const taxEx    = toNum(retailSalesRef.current?.value);
    const payCount = toNum(payCountRef.current?.value);
    setRetail({ taxEx, taxIn: taxEx * 1.1, payCount, done: true });
  };

  const confirmIb = () => {
    const c = {
      genWeekday:   toNum(ibGenWeekdayRef.current?.value),
      genHoliday:   toNum(ibGenHolidayRef.current?.value),
      childWeekday: toNum(ibChildWeekdayRef.current?.value),
      childHoliday: toNum(ibChildHolidayRef.current?.value),
      vip:          toNum(ibVipRef.current?.value),
    };
    const totalCount =
      c.genWeekday + c.genHoliday + c.childWeekday + c.childHoliday + c.vip;
    const totalAmount =
      c.genWeekday   * IB_PRICES.genWeekday   +
      c.genHoliday   * IB_PRICES.genHoliday   +
      c.childWeekday * IB_PRICES.childWeekday  +
      c.childHoliday * IB_PRICES.childHoliday  +
      c.vip          * IB_PRICES.vip;
    setIbTickets({ ...c, totalCount, totalAmount, done: true });
  };

  // チケット合計
  const ticketTotal = useMemo(() => {
    const taxIn = (csvData?.totalAmount ?? 0) + tokuten.amount + vip.amount;
    return {
      count:       (csvData?.totalCount ?? 0) + tokuten.sales + vip.sales,
      amountTaxIn: taxIn,
      amountTaxEx: taxIn / 1.1,
    };
  }, [csvData, tokuten, vip]);

  // レポートデータ
  const reportData: ReportData = useMemo(() => ({
    version: 1, date, reporter,
    csv: csvData ? { eventName: csvData.eventName, venue: csvData.venue, datetimes: csvData.datetimes, groups: csvData.groups, rows: csvData.rows, totalCount: csvData.totalCount, totalAmount: csvData.totalAmount } : null,
    tokuten: { prevRemaining: tokuten.prev, todayRemaining: tokuten.today, salesCount: tokuten.sales, unitPrice: TOKUTEN_PRICE, amount: tokuten.amount },
    kashikiriVip: { prevTotal: vip.prev, todayTotal: vip.today, salesCount: vip.sales, unitPrice: VIP_PRICE, amount: vip.amount },
    ticketTotal,
    retail: { salesTaxEx: retail.taxEx, salesTaxIn: retail.taxIn, paymentCount: retail.payCount },
    ibTickets: {
      genWeekday:   { count: ibTickets.genWeekday,   unitPrice: IB_PRICES.genWeekday,   amount: ibTickets.genWeekday   * IB_PRICES.genWeekday },
      genHoliday:   { count: ibTickets.genHoliday,   unitPrice: IB_PRICES.genHoliday,   amount: ibTickets.genHoliday   * IB_PRICES.genHoliday },
      childWeekday: { count: ibTickets.childWeekday, unitPrice: IB_PRICES.childWeekday, amount: ibTickets.childWeekday * IB_PRICES.childWeekday },
      childHoliday: { count: ibTickets.childHoliday, unitPrice: IB_PRICES.childHoliday, amount: ibTickets.childHoliday * IB_PRICES.childHoliday },
      vip:          { count: ibTickets.vip,           unitPrice: IB_PRICES.vip,          amount: ibTickets.vip          * IB_PRICES.vip },
      totalCount: ibTickets.totalCount, totalAmount: ibTickets.totalAmount,
    },
    operationNotes, irregularReport,
  }), [date, reporter, csvData, tokuten, vip, ticketTotal, retail, ibTickets, operationNotes, irregularReport]);

  // ─── 送信ハンドラ（formなし・useTransition） ──────────
  const handleSubmit = (submitAction: "draft" | "submit") => {
    const fd = new FormData();
    fd.set("report_date", date);
    fd.set("title", `${date} 日報${reporter ? ` (${reporter})` : ""}`);
    fd.set("content", JSON.stringify(reportData));
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
              <span className="font-semibold">¥{fmt(Math.round(ticketTotal.amountTaxEx))}</span>
            </div>
          </div>
        )}
      </Card>

      {/* ── ■リテール販売 ── */}
      <Card title="■ リテール販売">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <p className="text-xs text-[var(--muted-foreground)]">物販売り上げは税抜きで入力してください</p>
          <OkButton onClick={confirmRetail} done={retail.done} />
        </div>
        <div className="space-y-2 pl-1">
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--foreground)] w-28 shrink-0">物販売り上げ</span>
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-[var(--muted-foreground)]">¥</span>
              <input
                ref={retailSalesRef}
                type="number"
                min="0"
                defaultValue={initialData?.retail.salesTaxEx ?? ""}
                placeholder="0"
                className="w-32 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-right tabular-nums"
              />
              <span className="text-xs text-[var(--muted-foreground)]">（税抜き）</span>
            </div>
          </div>
          <NumInput label="決済件数" inputRef={payCountRef} unit="件" defaultValue={initialData?.retail.paymentCount ?? ""} />
        </div>
        {retail.done && (
          <ResultBox rows={[
            { label: "物販（税抜）", value: `¥${fmt(retail.taxEx)}` },
            { label: "物販（税込）", value: `¥${fmt(Math.round(retail.taxIn))}`, highlight: true },
            { label: "決済件数", value: `${fmt(retail.payCount)} 件` },
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
          {([
            ["一般（平日）",   ibGenWeekdayRef,   IB_PRICES.genWeekday,   initialData?.ibTickets.genWeekday.count],
            ["一般（休日）",   ibGenHolidayRef,   IB_PRICES.genHoliday,   initialData?.ibTickets.genHoliday.count],
            ["こども（平日）", ibChildWeekdayRef, IB_PRICES.childWeekday, initialData?.ibTickets.childWeekday.count],
            ["こども（休日）", ibChildHolidayRef, IB_PRICES.childHoliday, initialData?.ibTickets.childHoliday.count],
            ["貸切VIP",         ibVipRef,          IB_PRICES.vip,          initialData?.ibTickets.vip.count],
          ] as [string, React.RefObject<HTMLInputElement | null>, number, number | undefined][]).map(([label, ref, price, defVal]) => (
            <div key={label} className="flex items-center gap-3">
              <span className="text-sm text-[var(--foreground)] w-28 shrink-0">{label}</span>
              <div className="flex items-center gap-1.5">
                <input
                  ref={ref}
                  type="number"
                  min="0"
                  defaultValue={defVal ?? ""}
                  placeholder="0"
                  className="w-20 px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] text-right tabular-nums"
                />
                <span className="text-xs text-[var(--muted-foreground)]">枚 × ¥{fmt(price)}</span>
              </div>
            </div>
          ))}
        </div>
        {ibTickets.done && (
          <ResultBox rows={[
            { label: "一般（平日）",   value: `${fmt(ibTickets.genWeekday)}枚  ¥${fmt(ibTickets.genWeekday   * IB_PRICES.genWeekday)}` },
            { label: "一般（休日）",   value: `${fmt(ibTickets.genHoliday)}枚  ¥${fmt(ibTickets.genHoliday   * IB_PRICES.genHoliday)}` },
            { label: "こども（平日）", value: `${fmt(ibTickets.childWeekday)}枚  ¥${fmt(ibTickets.childWeekday * IB_PRICES.childWeekday)}` },
            { label: "こども（休日）", value: `${fmt(ibTickets.childHoliday)}枚  ¥${fmt(ibTickets.childHoliday * IB_PRICES.childHoliday)}` },
            { label: "貸切VIP",         value: `${fmt(ibTickets.vip)}枚  ¥${fmt(ibTickets.vip           * IB_PRICES.vip)}` },
            { label: "IB合計", value: `${fmt(ibTickets.totalCount)}枚 / ¥${fmt(ibTickets.totalAmount)}`, highlight: true },
          ]} />
        )}
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
        <PRow label="売上合計（税抜）" value={`¥${fmt(Math.round(data.ticketTotal.amountTaxEx))}`} />
      </PBlock>

      <PBlock title="■ リテール売上">
        <PRow label="物販（税抜）"  value={`¥${fmt(data.retail.salesTaxEx)}`} />
        <PRow label="物販（税込）"  value={`¥${fmt(Math.round(data.retail.salesTaxIn))}`} bold />
        <PRow label="決済件数"      value={`${fmt(data.retail.paymentCount)}件`} />
      </PBlock>

      <PBlock title="■ IB対応チケット">
        {([ ["一般（平日）", data.ibTickets.genWeekday], ["一般（休日）", data.ibTickets.genHoliday],
            ["こども（平日）", data.ibTickets.childWeekday], ["こども（休日）", data.ibTickets.childHoliday],
            ["貸切VIP", data.ibTickets.vip],
          ] as [string, { count: number; unitPrice: number; amount: number }][])
          .map(([label, r]) => (
            <PRow key={label} label={`${label}（×¥${fmt(r.unitPrice)}）`} value={`${fmt(r.count)}枚`} sub={`¥${fmt(r.amount)}`} />
          ))}
        <PRow label="IB合計" value={`${fmt(data.ibTickets.totalCount)}枚`} sub={`¥${fmt(data.ibTickets.totalAmount)}`} bold />
      </PBlock>

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
    </div>
  );
}
