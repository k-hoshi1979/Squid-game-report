import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { RecentReports } from "@/components/dashboard/RecentReports";
import { ActivityCalendar } from "@/components/dashboard/ActivityCalendar";
import { DashboardTabs } from "@/components/dashboard/DashboardTabs";
import type { SummaryMetrics, PeriodData, MetricSeriesPoint } from "@/components/dashboard/DashboardTabs";
import type { DailyReport } from "@/types/database";
import { parseReportContent } from "@/types/report";
import type { PieSlice } from "@/components/dashboard/PieChart";
import type { CalendarReport } from "@/app/api/reports/calendar/route";
import type { DashboardReportLite } from "@/app/api/dashboard/month-reports/route";

export const metadata: Metadata = { title: "ダッシュボード" };

// ─── 集計ヘルパー ─────────────────────────────────────────

function aggregateReports(reports: DailyReport[]): SummaryMetrics {
  let ticketAmount = 0, ticketCount = 0, retailAmount = 0, retailPayCount = 0;
  for (const r of reports) {
    const data = parseReportContent(r.content);
    if (!data) continue;
    ticketAmount   += data.ticketTotal?.amountTaxIn ?? 0;
    ticketCount    += data.ticketTotal?.count       ?? 0;
    retailAmount   += data.retail?.salesTaxIn        ?? 0;
    retailPayCount += data.retail?.paymentCount      ?? 0;
  }
  return { ticketAmount, ticketCount, retailAmount, retailPayCount };
}

function buildPieData(reports: DailyReport[]): { receptionPie: PieSlice[]; ticketTypePie: PieSlice[] } {
  const receptionMap  = new Map<string, number>();
  const ticketTypeMap = new Map<string, number>();

  for (const r of reports) {
    const data = parseReportContent(r.content);
    if (!data?.csv) continue;

    const groups = data.csv.groups ?? [];
    const rows   = data.csv.rows   ?? [];

    if (groups.length > 0) {
      for (const group of groups) {
        receptionMap.set(
          group.receptionName,
          (receptionMap.get(group.receptionName) ?? 0) + group.subtotalCount,
        );
        for (const row of group.rows) {
          ticketTypeMap.set(
            row.ticketType,
            (ticketTypeMap.get(row.ticketType) ?? 0) + row.count,
          );
        }
      }
    } else {
      for (const row of rows) {
        const recName = (row as { receptionName?: string }).receptionName;
        if (recName) {
          receptionMap.set(recName, (receptionMap.get(recName) ?? 0) + row.count);
        }
        ticketTypeMap.set(
          row.ticketType,
          (ticketTypeMap.get(row.ticketType) ?? 0) + row.count,
        );
      }
    }
  }

  const toSortedPie = (m: Map<string, number>): PieSlice[] =>
    [...m.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);

  return {
    receptionPie:  toSortedPie(receptionMap),
    ticketTypePie: toSortedPie(ticketTypeMap),
  };
}

// ─── 週の範囲（月曜始まり）────────────────────────────────

function getWeekRange(offsetWeeks: number): { start: string; end: string; label: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dayOfWeek + 6) % 7) + offsetWeeks * 7);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const pad2 = (n: number) => String(n).padStart(2, "0");
  const fmtD = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const label = `${pad2(monday.getMonth() + 1)}/${pad2(monday.getDate())}〜${pad2(sunday.getMonth() + 1)}/${pad2(sunday.getDate())}`;

  return { start: fmtD(monday), end: fmtD(sunday), label };
}

function localDateStr(d: Date) {
  const pad2 = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function buildMetricSeries(reports: DailyReport[]): MetricSeriesPoint[] {
  const byDate = new Map<string, MetricSeriesPoint>();

  for (const r of reports) {
    const data = parseReportContent(r.content);
    const date = r.report_date;
    const current = byDate.get(date) ?? {
      date,
      ticketAmount: 0,
      ticketCount: 0,
      retailAmount: 0,
      retailPayCount: 0,
    };

    current.ticketAmount += data?.ticketTotal?.amountTaxIn ?? 0;
    current.ticketCount += data?.ticketTotal?.count ?? 0;
    current.retailAmount += data?.retail?.salesTaxIn ?? 0;
    current.retailPayCount += data?.retail?.paymentCount ?? 0;

    byDate.set(date, current);
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

// ─── データ取得 ───────────────────────────────────────────

interface DashboardData {
  initialMonthReports: DashboardReportLite[];
  initialMonthKey: string;
  monthly:         PeriodData;
  weekly:          PeriodData;
  prevWeekSummary: SummaryMetrics;
  daily:           PeriodData;
  recentReports:    DailyReport[];
  calendarReports:  CalendarReport[];
  monthLabel:      string;
  weekLabel:       string;
  todayLabel:      string;
  isDemo:          boolean;
}

const ZERO: SummaryMetrics = { ticketAmount: 0, ticketCount: 0, retailAmount: 0, retailPayCount: 0 };
const EMPTY_PERIOD: PeriodData = { summary: ZERO, series: [], receptionPie: [], ticketTypePie: [] };

async function getDashboardData(): Promise<DashboardData> {
  const now   = new Date();
  const today = localDateStr(now);
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const thisWeek = getWeekRange(0);
  const prevWeek = getWeekRange(-1);

  const monthLabel = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long" }).format(now);
  const todayLabel = new Intl.DateTimeFormat("ja-JP", { year: "numeric", month: "long", day: "numeric" }).format(now);

  const DEMO: DashboardData = {
    initialMonthReports: [],
    initialMonthKey: localDateStr(now).slice(0, 7),
    monthly:         EMPTY_PERIOD,
    weekly:          EMPTY_PERIOD,
    prevWeekSummary: ZERO,
    daily:           EMPTY_PERIOD,
    recentReports:   [],
    calendarReports: [],
    monthLabel,
    weekLabel:  thisWeek.label,
    todayLabel,
    isDemo: true,
  };

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEMO;

    const STATUSES = ["submitted", "revised", "confirmed"] as const;

    // 並列フェッチ
    const [
      { data: monthlyReports },
      { data: thisWeekReports },
      { data: prevWeekReports },
      { data: todayReports },
      { data: recentReports },
      { data: calendarReports },
    ] = await Promise.all([
      // 今月
      supabase.from("daily_reports").select("*")
        .eq("user_id", user.id).gte("report_date", firstOfMonth)
        .in("status", STATUSES),
      // 今週
      supabase.from("daily_reports").select("*")
        .eq("user_id", user.id)
        .gte("report_date", thisWeek.start).lte("report_date", thisWeek.end)
        .in("status", STATUSES),
      // 先週
      supabase.from("daily_reports").select("*")
        .eq("user_id", user.id)
        .gte("report_date", prevWeek.start).lte("report_date", prevWeek.end)
        .in("status", STATUSES),
      // 当日
      supabase.from("daily_reports").select("*")
        .eq("user_id", user.id).eq("report_date", today)
        .in("status", STATUSES),
      // 最近5件（全ステータス）
      supabase.from("daily_reports").select("*")
        .eq("user_id", user.id)
        .order("report_date", { ascending: false }).limit(5),
      // カレンダー用（id 含む）
      supabase.from("daily_reports").select("id, report_date, status")
        .eq("user_id", user.id).gte("report_date", firstOfMonth)
        .in("status", STATUSES),
    ]);

    const monthlyPie  = buildPieData(monthlyReports  ?? []);
    const weeklyPie   = buildPieData(thisWeekReports  ?? []);
    const dailyPie    = buildPieData(todayReports     ?? []);

    const calendarEntries: CalendarReport[] = (calendarReports ?? []).map((r) => ({
      id:     r.id,
      date:   r.report_date,
      status: r.status,
    }));

    const initialMonthReports = (monthlyReports ?? []).map((r) => ({
      id: r.id,
      report_date: r.report_date,
      status: r.status,
      content: r.content,
    }));

    return {
      initialMonthReports,
      initialMonthKey: firstOfMonth.slice(0, 7),
      monthly: {
        summary:      aggregateReports(monthlyReports  ?? []),
        series:       buildMetricSeries(monthlyReports ?? []),
        receptionPie:  monthlyPie.receptionPie,
        ticketTypePie: monthlyPie.ticketTypePie,
      },
      weekly: {
        summary:      aggregateReports(thisWeekReports ?? []),
        series:       buildMetricSeries(thisWeekReports ?? []),
        receptionPie:  weeklyPie.receptionPie,
        ticketTypePie: weeklyPie.ticketTypePie,
      },
      prevWeekSummary: aggregateReports(prevWeekReports ?? []),
      daily: {
        summary:      aggregateReports(todayReports    ?? []),
        series:       buildMetricSeries(todayReports ?? []),
        receptionPie:  dailyPie.receptionPie,
        ticketTypePie: dailyPie.ticketTypePie,
      },
      recentReports:   recentReports   ?? [],
      calendarReports: calendarEntries,
      monthLabel,
      weekLabel:  thisWeek.label,
      todayLabel,
      isDemo: false,
    };
  } catch {
    return DEMO;
  }
}

// ─── ページ ───────────────────────────────────────────────

export default async function DashboardPage() {
  const {
    initialMonthReports,
    initialMonthKey,
    monthly, weekly, prevWeekSummary, daily,
    recentReports, calendarReports,
    monthLabel, weekLabel, todayLabel,
    isDemo,
  } = await getDashboardData();

  const now = new Date();

  return (
    <>
      <Header
        title="ダッシュボード"
        action={
          <Link
            href="/reports/new"
            className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            新規作成
          </Link>
        }
      />

      <main className="flex-1 p-3 sm:p-6 space-y-4 sm:space-y-6">
        {isDemo && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:border-amber-800 dark:text-amber-200">
            <strong>デモモード:</strong> Supabaseに接続されていないため、データが表示されません。
          </div>
        )}

        {/* ── タブ付きサマリー＋円グラフ ── */}
        <DashboardTabs
          initialMonthReports={initialMonthReports}
          initialMonthKey={initialMonthKey}
        />

        {/* ── 最近の日報 + カレンダー ── */}
        <section>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <RecentReports reports={recentReports} />
            </div>
            <div>
              <ActivityCalendar
                initialReports={calendarReports}
                initialYear={now.getFullYear()}
                initialMonth={now.getMonth() + 1}
              />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
