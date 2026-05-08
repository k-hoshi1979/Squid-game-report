"use client";

import { useEffect, useMemo, useState } from "react";
import { PieChart } from "./PieChart";
import type { PieSlice } from "./PieChart";
import type { DashboardReportLite } from "@/app/api/dashboard/month-reports/route";
import { parseReportContent } from "@/types/report";

// ─── 型定義 ──────────────────────────────────────────────

export interface SummaryMetrics {
  ticketAmount:   number;
  ticketCount:    number;
  retailAmount:   number;
  retailPayCount: number;
}

export interface MetricSeriesPoint {
  date: string;
  ticketAmount: number;
  ticketCount: number;
  retailAmount: number;
  retailPayCount: number;
}

export interface PeriodData {
  summary:       SummaryMetrics;
  series:        MetricSeriesPoint[];
  receptionPie:  PieSlice[];
  ticketTypePie: PieSlice[];
}

export interface DashboardTabsProps {
  initialMonthReports: DashboardReportLite[];
  initialMonthKey: string;
}

// ─── フォーマット ─────────────────────────────────────────

const fmt  = (n: number) => new Intl.NumberFormat("ja-JP").format(Math.round(n));
const fmtY = (n: number) => `¥${fmt(n)}`;

// ─── 差分バッジ ───────────────────────────────────────────

function DiffBadge({ current, prev }: { current: number; prev: number }) {
  if (prev === 0) return null;
  const diff = current - prev;
  const pct  = ((diff / prev) * 100).toFixed(1);
  const up   = diff >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md ${
      up ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
         : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
    }`}>
      {up ? "▲" : "▼"} {Math.abs(Number(pct))}%
    </span>
  );
}

// ─── サマリーカード ───────────────────────────────────────

const colorMap = {
  blue:   "from-blue-500   to-blue-600",
  green:  "from-green-500  to-green-600",
  orange: "from-orange-500 to-orange-600",
  purple: "from-purple-500 to-purple-600",
};

interface SummaryCardProps {
  label:    string;
  value:    string;
  subLabel: string;
  color:    "blue" | "green" | "orange" | "purple";
  selected?: boolean;
  onClick?: () => void;
  compRow?: React.ReactNode;
}

function SummaryCard({ label, value, subLabel, color, selected = false, onClick, compRow }: SummaryCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`bg-[var(--card)] border rounded-xl p-5 shadow-sm relative overflow-hidden text-left w-full transition-all ${
        selected
          ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/25"
          : "border-[var(--border)] hover:border-[var(--primary)]/60"
      }`}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${colorMap[color]} rounded-l-xl`} />
      <div className="pl-3">
        <p className="text-xs text-[var(--muted-foreground)] font-medium mb-1">{label}</p>
        <p className="text-xl sm:text-2xl font-bold text-[var(--foreground)] tabular-nums break-all">{value}</p>
        {compRow && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]">
            {compRow}
          </div>
        )}
        <p className="text-xs text-[var(--muted-foreground)] mt-0.5">{subLabel}</p>
      </div>
    </button>
  );
}

type MetricKey = "ticketAmount" | "ticketCount" | "retailAmount" | "retailPayCount";
const METRICS: { key: MetricKey; label: string; color: string; format: (n: number) => string }[] = [
  { key: "ticketAmount", label: "チケット総売り上げ（税込）", color: "bg-blue-500", format: fmtY },
  { key: "ticketCount", label: "チケット販売数", color: "bg-green-500", format: (n) => `${fmt(n)}枚` },
  { key: "retailAmount", label: "リテール総売り上げ（税込）", color: "bg-orange-500", format: fmtY },
  { key: "retailPayCount", label: "決済件数", color: "bg-purple-500", format: (n) => `${fmt(n)}件` },
];

function MetricBarChart({
  title,
  metric,
  points,
  vertical = false,
}: {
  title: string;
  metric: MetricKey;
  points: MetricSeriesPoint[];
  vertical?: boolean;
}) {
  const meta = METRICS.find((m) => m.key === metric)!;
  const values = points.map((p) => p[metric]);
  const max = Math.max(...values, 0);

  if (points.length === 0) {
    return (
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[var(--foreground)] mb-2">{title}</h3>
        <p className="text-sm text-[var(--muted-foreground)]">詳細グラフ用のデータがありません。</p>
      </div>
    );
  }

  if (vertical) {
    const showTick = (index: number) => {
      if (points.length <= 7) return true;
      if (index === 0 || index === points.length - 1) return true;
      return index % 5 === 0;
    };
    return (
      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 shadow-sm">
        <h3 className="text-sm font-bold text-[var(--foreground)] mb-1">{title}</h3>
        <p className="text-xs text-[var(--muted-foreground)] mb-3">{meta.label}</p>
        <div className="h-60 border border-[var(--border)] rounded-lg p-3 overflow-x-auto overflow-y-hidden">
          <div className="h-full min-w-[560px] flex items-end gap-1.5">
            {points.map((p, i) => {
              const value = p[metric];
              const height = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
              const day = p.date.slice(8);
              return (
                <div key={`${metric}-${p.date}`} className="flex-1 min-w-[14px] flex flex-col items-center justify-end gap-1">
                  <div className="w-full h-44 flex items-end">
                    <div
                      className={`w-full rounded-t ${meta.color}`}
                      style={{ height: `${height}%` }}
                      title={`${p.date}: ${meta.format(value)}`}
                    />
                  </div>
                  <span className="text-[10px] text-[var(--muted-foreground)] tabular-nums h-3 leading-3">
                    {showTick(i) ? Number(day) : ""}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-5 shadow-sm">
      <h3 className="text-sm font-bold text-[var(--foreground)] mb-1">{title}</h3>
      <p className="text-xs text-[var(--muted-foreground)] mb-4">{meta.label}</p>
      <div className="space-y-2.5">
        {points.map((p) => {
          const value = p[metric];
          const width = max > 0 ? Math.max((value / max) * 100, value > 0 ? 4 : 0) : 0;
          return (
            <div key={`${metric}-${p.date}`}>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-[var(--muted-foreground)]">{p.date.slice(5)}</span>
                <span className="font-semibold text-[var(--foreground)]">{meta.format(value)}</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--muted)] overflow-hidden">
                <div className={`h-full rounded-full ${meta.color}`} style={{ width: `${width}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function toMonthKey(date: Date) {
  const p2 = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p2(date.getMonth() + 1)}`;
}

function isValidMonthKey(value: string) {
  return /^\d{4}-\d{2}$/.test(value);
}

function getWeekRangesByMonday(monthKey: string): { week: number; start: string; end: string; label: string }[] {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(5, 7));
  const p2 = (n: number) => String(n).padStart(2, "0");

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const firstMonday = new Date(monthStart);
  const shift = (8 - monthStart.getDay()) % 7;
  firstMonday.setDate(monthStart.getDate() + shift);

  const ranges: { week: number; start: string; end: string; label: string }[] = [];
  let cursor = new Date(firstMonday);
  let week = 1;

  while (cursor <= monthEnd) {
    const end = new Date(cursor);
    end.setDate(cursor.getDate() + 6);
    const displayEnd = end > monthEnd ? monthEnd : end;

    const startStr = `${cursor.getFullYear()}-${p2(cursor.getMonth() + 1)}-${p2(cursor.getDate())}`;
    const endStr = `${end.getFullYear()}-${p2(end.getMonth() + 1)}-${p2(end.getDate())}`;
    const label = `${week}週 (${p2(cursor.getMonth() + 1)}/${p2(cursor.getDate())}〜${p2(displayEnd.getMonth() + 1)}/${p2(displayEnd.getDate())})`;

    ranges.push({ week, start: startStr, end: endStr, label });
    cursor.setDate(cursor.getDate() + 7);
    week += 1;
  }

  return ranges;
}

function aggregateReports(reports: DashboardReportLite[]): SummaryMetrics {
  let ticketAmount = 0;
  let ticketCount = 0;
  let retailAmount = 0;
  let retailPayCount = 0;

  for (const r of reports) {
    const data = parseReportContent(r.content);
    if (!data) continue;
    ticketAmount += data.ticketTotal?.amountTaxIn ?? 0;
    ticketCount += data.ticketTotal?.count ?? 0;
    retailAmount += data.retail?.salesTaxIn ?? 0;
    retailPayCount += data.retail?.paymentCount ?? 0;
  }
  return { ticketAmount, ticketCount, retailAmount, retailPayCount };
}

function buildMetricSeries(reports: DashboardReportLite[]): MetricSeriesPoint[] {
  const byDate = new Map<string, MetricSeriesPoint>();

  for (const r of reports) {
    const data = parseReportContent(r.content);
    const current = byDate.get(r.report_date) ?? {
      date: r.report_date,
      ticketAmount: 0,
      ticketCount: 0,
      retailAmount: 0,
      retailPayCount: 0,
    };
    current.ticketAmount += data?.ticketTotal?.amountTaxIn ?? 0;
    current.ticketCount += data?.ticketTotal?.count ?? 0;
    current.retailAmount += data?.retail?.salesTaxIn ?? 0;
    current.retailPayCount += data?.retail?.paymentCount ?? 0;
    byDate.set(r.report_date, current);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function buildPieData(reports: DashboardReportLite[]): { receptionPie: PieSlice[]; ticketTypePie: PieSlice[] } {
  const receptionMap = new Map<string, number>();
  const ticketTypeMap = new Map<string, number>();

  for (const r of reports) {
    const data = parseReportContent(r.content);
    if (!data?.csv) continue;
    const groups = data.csv.groups ?? [];
    const rows = data.csv.rows ?? [];

    if (groups.length > 0) {
      for (const g of groups) {
        receptionMap.set(g.receptionName, (receptionMap.get(g.receptionName) ?? 0) + g.subtotalCount);
        for (const row of g.rows) {
          ticketTypeMap.set(row.ticketType, (ticketTypeMap.get(row.ticketType) ?? 0) + row.count);
        }
      }
    } else {
      for (const row of rows) {
        const recName = (row as { receptionName?: string }).receptionName;
        if (recName) {
          receptionMap.set(recName, (receptionMap.get(recName) ?? 0) + row.count);
        }
        ticketTypeMap.set(row.ticketType, (ticketTypeMap.get(row.ticketType) ?? 0) + row.count);
      }
    }
  }

  const toSorted = (m: Map<string, number>) =>
    [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  return { receptionPie: toSorted(receptionMap), ticketTypePie: toSorted(ticketTypeMap) };
}

function buildPeriodData(reports: DashboardReportLite[]): PeriodData {
  const pie = buildPieData(reports);
  return {
    summary: aggregateReports(reports),
    series: buildMetricSeries(reports),
    receptionPie: pie.receptionPie,
    ticketTypePie: pie.ticketTypePie,
  };
}

// ─── タブ定義 ─────────────────────────────────────────────

type TabId = "monthly" | "weekly" | "daily";
const TABS: { id: TabId; label: string }[] = [
  { id: "monthly", label: "月間" },
  { id: "weekly",  label: "週間" },
  { id: "daily",   label: "日別" },
];

// ─── メインコンポーネント ─────────────────────────────────

export function DashboardTabs({
  initialMonthReports,
  initialMonthKey,
}: DashboardTabsProps) {
  const fallbackMonthKey = toMonthKey(new Date());
  const initialKey = isValidMonthKey(initialMonthKey) ? initialMonthKey : fallbackMonthKey;
  const [activeTab, setActiveTab] = useState<TabId>("monthly");
  const [activeMetric, setActiveMetric] = useState<MetricKey>("ticketAmount");
  const [selectedMonth, setSelectedMonth] = useState(initialKey);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [selectedDate, setSelectedDate] = useState(`${initialKey}-01`);
  const [monthReports, setMonthReports] = useState<DashboardReportLite[]>(initialMonthReports);
  const [isLoading, setIsLoading] = useState(false);

  const safeMonthKey = isValidMonthKey(selectedMonth) ? selectedMonth : fallbackMonthKey;
  const weekRanges = useMemo(() => getWeekRangesByMonday(safeMonthKey), [safeMonthKey]);

  useEffect(() => {
    if (selectedWeek > weekRanges.length && weekRanges.length > 0) {
      setSelectedWeek(weekRanges.length);
    }
  }, [selectedWeek, weekRanges.length]);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`/api/dashboard/month-reports?month=${safeMonthKey}`);
        if (!res.ok) return;
        const json = await res.json();
        setMonthReports((json.reports ?? []) as DashboardReportLite[]);
      } finally {
        setIsLoading(false);
      }
    };
    run();
  }, [safeMonthKey]);

  const monthDate = new Date(`${safeMonthKey}-01T00:00:00`);
  const monthLabelDynamic = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(monthDate);
  const dayLabelDynamic = selectedDate;

  const weeklyReports = useMemo(() => {
    const selectedRange = weekRanges.find((w) => w.week === selectedWeek);
    if (!selectedRange) return [];
    return monthReports.filter((r) => r.report_date >= selectedRange.start && r.report_date <= selectedRange.end);
  }, [monthReports, selectedWeek, weekRanges]);

  const dailyReports = useMemo(
    () => monthReports.filter((r) => r.report_date === selectedDate),
    [monthReports, selectedDate],
  );

  const monthlyData = useMemo(() => buildPeriodData(monthReports), [monthReports]);
  const weeklyData = useMemo(() => buildPeriodData(weeklyReports), [weeklyReports]);
  const dailyData = useMemo(() => buildPeriodData(dailyReports), [dailyReports]);

  const current: PeriodData =
    activeTab === "monthly" ? monthlyData : activeTab === "weekly" ? weeklyData : dailyData;

  const selectedRange = weekRanges.find((w) => w.week === selectedWeek);
  const periodTitle: Record<TabId, string> = {
    monthly: `${monthLabelDynamic} 月間サマリー`,
    weekly: `${selectedRange?.label ?? "週間"} サマリー`,
    daily: `${dayLabelDynamic} 日別サマリー`,
  };

  const pieTitle: Record<TabId, string> = {
    monthly: `チケット販売内訳（${monthLabelDynamic}）`,
    weekly: `チケット販売内訳（${selectedRange?.label ?? "週間"}）`,
    daily: `チケット販売内訳（${dayLabelDynamic}）`,
  };

  const prevWeekData = useMemo(() => {
    if (selectedWeek <= 1) return null;
    const prev = weekRanges.find((w) => w.week === selectedWeek - 1);
    if (!prev) return null;
    const prevReports = monthReports.filter((r) => r.report_date >= prev.start && r.report_date <= prev.end);
    return buildPeriodData(prevReports);
  }, [monthReports, selectedWeek, weekRanges]);

  const showComparison = activeTab === "weekly" && !!prevWeekData;

  const makeCompRow = (currentValue: number, prevValue: number, fmtFn: (n: number) => string) =>
    showComparison ? (
      <>
        <span className="text-xs text-[var(--muted-foreground)]">
          今週 {fmtFn(currentValue)} / 先週 {fmtFn(prevValue)}
        </span>
        <DiffBadge current={currentValue} prev={prevValue} />
      </>
    ) : null;

  const subLabels: Record<TabId, { ticket: string; count: string; retail: string; pay: string }> = {
    monthly: {
      ticket: "今月の確定チケット売上合計",
      count:  "今月の販売枚数合計",
      retail: "今月の物販売上合計",
      pay:    "今月の決済合計件数",
    },
    weekly: {
      ticket: "今週の確定チケット売上合計",
      count:  "今週の販売枚数合計",
      retail: "今週の物販売上合計",
      pay:    "今週の決済合計件数",
    },
    daily: {
      ticket: "本日の確定チケット売上合計",
      count:  "本日の販売枚数合計",
      retail: "本日の物販売上合計",
      pay:    "本日の決済合計件数",
    },
  };

  const sub = subLabels[activeTab];

  return (
    <div className="space-y-6">
      {/* タブバー */}
      <div className="flex items-center gap-1 p-1 bg-[var(--muted)] rounded-xl w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.id
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* サマリーカード */}
      <section>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {activeTab !== "daily" && (
            <label className="text-xs text-[var(--muted-foreground)] inline-flex items-center gap-2">
              基準月
              <input
                type="month"
                value={safeMonthKey}
                onChange={(e) => {
                  if (!isValidMonthKey(e.target.value)) return;
                  setSelectedMonth(e.target.value);
                  const firstDay = `${e.target.value}-01`;
                  setSelectedDate(firstDay);
                  setSelectedWeek(1);
                }}
                className="px-2 py-1 border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
              />
            </label>
          )}
          {activeTab === "weekly" && (
            <label className="text-xs text-[var(--muted-foreground)] inline-flex items-center gap-2">
              基準週
              <select
                value={selectedWeek}
                onChange={(e) => setSelectedWeek(Number(e.target.value))}
                className="px-2 py-1 border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
              >
                {weekRanges.map((w) => (
                  <option key={w.week} value={w.week}>
                    {w.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {activeTab === "daily" && (
            <label className="text-xs text-[var(--muted-foreground)] inline-flex items-center gap-2">
              指定日
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  if (!e.target.value) return;
                  setSelectedDate(e.target.value);
                  const monthKey = e.target.value.slice(0, 7);
                  if (isValidMonthKey(monthKey) && monthKey !== selectedMonth) setSelectedMonth(monthKey);
                }}
                className="px-2 py-1 border border-[var(--border)] rounded-md bg-[var(--background)] text-[var(--foreground)]"
              />
            </label>
          )}
          {isLoading && <span className="text-xs text-[var(--muted-foreground)]">読込中...</span>}
        </div>
        <h2 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
          {periodTitle[activeTab]}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <SummaryCard
            label="チケット総売り上げ（税込）"
            value={fmtY(current.summary.ticketAmount)}
            subLabel={sub.ticket}
            color="blue"
            selected={activeMetric === "ticketAmount"}
            onClick={() => setActiveMetric("ticketAmount")}
            compRow={makeCompRow(
              weeklyData.summary.ticketAmount,
              prevWeekData?.summary.ticketAmount ?? 0,
              fmtY,
            )}
          />
          <SummaryCard
            label="チケット販売数"
            value={`${fmt(current.summary.ticketCount)}枚`}
            subLabel={sub.count}
            color="green"
            selected={activeMetric === "ticketCount"}
            onClick={() => setActiveMetric("ticketCount")}
            compRow={makeCompRow(
              weeklyData.summary.ticketCount,
              prevWeekData?.summary.ticketCount ?? 0,
              (n) => `${fmt(n)}枚`,
            )}
          />
          <SummaryCard
            label="リテール総売り上げ（税込）"
            value={fmtY(current.summary.retailAmount)}
            subLabel={sub.retail}
            color="orange"
            selected={activeMetric === "retailAmount"}
            onClick={() => setActiveMetric("retailAmount")}
            compRow={makeCompRow(
              weeklyData.summary.retailAmount,
              prevWeekData?.summary.retailAmount ?? 0,
              fmtY,
            )}
          />
          <SummaryCard
            label="決済件数"
            value={`${fmt(current.summary.retailPayCount)}件`}
            subLabel={sub.pay}
            color="purple"
            selected={activeMetric === "retailPayCount"}
            onClick={() => setActiveMetric("retailPayCount")}
            compRow={makeCompRow(
              weeklyData.summary.retailPayCount,
              prevWeekData?.summary.retailPayCount ?? 0,
              (n) => `${fmt(n)}件`,
            )}
          />
        </div>
      </section>

      <section>
        <MetricBarChart
          title={`${periodTitle[activeTab]} 詳細グラフ（クリック選択）`}
          metric={activeMetric}
          points={current.series}
          vertical={activeTab === "monthly"}
        />
      </section>

      {/* 円グラフ */}
      <section>
        <h2 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
          {pieTitle[activeTab]}
        </h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PieChart title="受付名別（E列）"  slices={current.receptionPie}  unit="枚" />
          <PieChart title="販売区分別（H列）" slices={current.ticketTypePie} unit="枚" />
        </div>
      </section>
    </div>
  );
}
