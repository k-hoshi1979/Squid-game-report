"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import type { CalendarReport } from "@/app/api/reports/calendar/route";

interface ActivityCalendarProps {
  initialReports?: CalendarReport[];
  initialYear?:    number;
  initialMonth?:   number;  // 1-12
}

const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate(); // month は 1-12
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay(); // 0=日
}
function pad2(n: number) {
  return String(n).padStart(2, "0");
}

export function ActivityCalendar({
  initialReports = [],
  initialYear,
  initialMonth,
}: ActivityCalendarProps) {
  const today      = new Date();
  const todayYear  = today.getFullYear();
  const todayMonth = today.getMonth() + 1;
  const todayDay   = today.getDate();

  const [year,      setYear]      = useState(initialYear  ?? todayYear);
  const [month,     setMonth]     = useState(initialMonth ?? todayMonth);
  const [reports,   setReports]   = useState<CalendarReport[]>(initialReports);
  const [isLoading, setIsLoading] = useState(false);

  // 初回レンダリングかどうかのフラグ（初期データ再フェッチを防ぐ）
  const [hasMounted, setHasMounted] = useState(false);

  const fetchReports = useCallback(async (y: number, m: number) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/reports/calendar?year=${y}&month=${m}`);
      if (res.ok) {
        const json = await res.json();
        setReports(json.reports ?? []);
      }
    } catch {
      // ネットワークエラーは無視
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      setHasMounted(true);
      return;
    }
    fetchReports(year, month);
  }, [year, month]); // eslint-disable-line react-hooks/exhaustive-deps

  const goPrevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else { setMonth((m) => m - 1); }
  };
  const goNextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else { setMonth((m) => m + 1); }
  };
  const goToday = () => { setYear(todayYear); setMonth(todayMonth); };

  // 日付マップ構築
  const reportMap = new Map<string, CalendarReport>();
  for (const r of reports) reportMap.set(r.date, r);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay    = getFirstDayOfMonth(year, month);

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const monthLabel = new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "long",
  }).format(new Date(year, month - 1));

  const isCurrentMonth = year === todayYear && month === todayMonth;

  const submittedCount = reports.filter((r) => r.status !== "confirmed").length;
  const confirmedCount = reports.filter((r) => r.status === "confirmed").length;

  return (
    <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] p-3 sm:p-5 shadow-sm">
      {/* ヘッダー：月ナビゲーション */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          {monthLabel}
          {isLoading && (
            <span className="ml-2 inline-block w-3 h-3 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin align-middle" />
          )}
        </h2>
        <div className="flex items-center gap-1">
          {!isCurrentMonth && (
            <button
              onClick={goToday}
              className="px-2 py-1 text-xs text-[var(--primary)] hover:bg-[var(--muted)] rounded-md transition-colors font-medium"
            >
              今月
            </button>
          )}
          <button
            onClick={goPrevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
            aria-label="前の月"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goNextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-md hover:bg-[var(--muted)] transition-colors text-[var(--muted-foreground)]"
            aria-label="次の月"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* カレンダーグリッド */}
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAYS.map((day) => (
          <div key={day} className="text-center text-xs font-medium text-[var(--muted-foreground)] pb-1">
            {day}
          </div>
        ))}
        {cells.map((day, idx) => {
          if (day === null) return <div key={`empty-${idx}`} />;

          const dateStr   = `${year}-${pad2(month)}-${pad2(day)}`;
          const report    = reportMap.get(dateStr);
          const isToday   = isCurrentMonth && day === todayDay;
          const isConfirmed = report?.status === "confirmed";
          const hasReport   = !!report;
          const isPast      = !isCurrentMonth
            || day < todayDay
            || (day === todayDay);
          const isFuture  = isCurrentMonth && day > todayDay;

          const cellClass = `
            relative aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-colors
            ${isFuture ? "opacity-30 cursor-default" : ""}
            ${isToday && !hasReport ? "ring-2 ring-[var(--primary)] ring-offset-1 text-[var(--primary)]" : ""}
            ${isConfirmed
              ? "bg-green-500 text-white hover:bg-green-600 cursor-pointer"
              : hasReport
                ? "bg-[var(--primary)] text-white hover:bg-blue-600 cursor-pointer"
                : isPast && !isFuture
                  ? "text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)] cursor-pointer"
                  : "text-[var(--muted-foreground)]"
            }
          `;

          const title = isConfirmed
            ? `${dateStr}　確認済み — クリックで開く`
            : hasReport
              ? `${dateStr}　日報あり — クリックで開く`
              : isPast && !isFuture
                ? `${dateStr}　日報なし — クリックで作成`
                : dateStr;

          // 日報あり → 詳細ページ、日報なし（過去・当日）→ 新規作成
          const href = hasReport
            ? `/reports/${report!.id}`
            : `/reports/new`;

          return isFuture ? (
            <div key={dateStr} className={cellClass} title={dateStr}>
              {day}
            </div>
          ) : (
            <Link
              key={dateStr}
              href={href}
              className={cellClass}
              title={title}
            >
              {day}
              {isConfirmed && (
                <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                  <svg className="w-2.5 h-2.5 text-green-600" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* 凡例 */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-[var(--muted-foreground)]">
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-[var(--primary)] inline-block" />
          提出済み ({submittedCount}件)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-500 inline-block" />
          確認済み ({confirmedCount}件)
        </span>
        <span className="flex items-center gap-1.5 ml-auto text-[10px] opacity-70">
          日付をクリックで日報を開く
        </span>
      </div>
    </div>
  );
}
