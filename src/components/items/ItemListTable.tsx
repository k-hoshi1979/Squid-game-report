"use client";

import { useRouter } from "next/navigation";
import {
  ITEM_LIST_SECTIONS,
  getSectionById,
  type ItemListSectionId,
} from "@/lib/report/itemListSpec";
import {
  formatDateLabel,
  formatDayHeader,
  type ItemListTextFields,
} from "@/lib/report/extractItemValues";

interface ItemListTableProps {
  yearMonth: string;
  sectionId: ItemListSectionId;
  days: string[];
  valuesByDate: Record<string, number[]>;
  snsByDate: Record<string, number[]>;
  textByDate: Record<string, ItemListTextFields>;
}

function formatCell(value: number | undefined): string {
  if (value === undefined) return "—";
  if (value === 0) return "0";
  return new Intl.NumberFormat("ja-JP").format(value);
}

function buildItemsUrl(yearMonth: string, sectionId: ItemListSectionId): string {
  return `/items?month=${yearMonth}&section=${sectionId}`;
}

export function ItemListTable({
  yearMonth,
  sectionId,
  days,
  valuesByDate,
  snsByDate,
  textByDate,
}: ItemListTableProps) {
  const router = useRouter();
  const section = getSectionById(sectionId);

  const shiftMonth = (delta: number) => {
    const [y, m] = yearMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    const pad = (n: number) => String(n).padStart(2, "0");
    const next = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    router.push(buildItemsUrl(next, sectionId));
  };

  const [y, m] = yearMonth.split("-").map(Number);
  const monthLabel = `${y}年${m}月`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--muted)] transition-colors"
            aria-label="前月"
          >
            ←
          </button>
          <span className="text-sm font-bold text-[var(--foreground)] min-w-[6rem] text-center">
            {monthLabel}
          </span>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm hover:bg-[var(--muted)] transition-colors"
            aria-label="翌月"
          >
            →
          </button>
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {section.kind === "numeric"
            ? "項目を縦軸、日付（昇順）を横軸に表示しています。"
            : "日付（昇順）ごとにテキストを表示しています。"}
        </p>
      </div>

      <div
        className="flex gap-1 overflow-x-auto border-b border-[var(--border)] pb-px"
        role="tablist"
        aria-label="項目カテゴリ"
      >
        {ITEM_LIST_SECTIONS.map((tab) => {
          const active = tab.id === sectionId;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => router.push(buildItemsUrl(yearMonth, tab.id))}
              className={[
                "shrink-0 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors",
                active
                  ? "border-[var(--primary)] text-[var(--primary)] bg-[var(--card)]"
                  : "border-transparent text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/60",
              ].join(" ")}
            >
              {tab.tabLabel}
            </button>
          );
        })}
      </div>

      <div className="border border-[var(--border)] rounded-xl overflow-hidden bg-[var(--card)] shadow-sm">
        {section.kind === "numeric" ? (
          <NumericSectionTable
            section={section}
            days={days}
            valuesByDate={section.id === "sns" ? snsByDate : valuesByDate}
          />
        ) : (
          <TextSectionTable
            sectionId={sectionId}
            days={days}
            textByDate={textByDate}
          />
        )}
      </div>
    </div>
  );
}

function NumericSectionTable({
  section,
  days,
  valuesByDate,
}: {
  section: ReturnType<typeof getSectionById>;
  days: string[];
  valuesByDate: Record<string, number[]>;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-max min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
            <th className="sticky left-0 z-20 bg-[var(--muted)] text-left px-3 py-2 font-semibold text-[var(--foreground)] min-w-[12rem] max-w-[20rem] border-r border-[var(--border)]">
              項目
            </th>
            {days.map((date) => (
              <th
                key={date}
                className="px-2 py-2 text-center font-medium text-[var(--muted-foreground)] min-w-[3rem] whitespace-nowrap"
              >
                {formatDayHeader(date)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {section.labels.map((label, labelIndex) => {
            const valueIndex =
              section.id === "sns" ? labelIndex : section.rowOffset + labelIndex;
            return (
              <tr
                key={`${section.id}-${valueIndex}`}
                className="border-b border-[var(--border)]/60 hover:bg-[var(--muted)]/40"
              >
                <td className="sticky left-0 z-10 bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--foreground)] border-r border-[var(--border)] max-w-[20rem]">
                  {label}
                </td>
                {days.map((date) => {
                  const values = valuesByDate[date];
                  const value = values?.[valueIndex];
                  return (
                    <td
                      key={date}
                      className="px-2 py-1.5 text-right tabular-nums text-xs text-[var(--foreground)]"
                    >
                      {formatCell(value)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function TextSectionTable({
  sectionId,
  days,
  textByDate,
}: {
  sectionId: ItemListSectionId;
  days: string[];
  textByDate: Record<string, ItemListTextFields>;
}) {
  const textKey: keyof ItemListTextFields =
    sectionId === "operation"
      ? "operationNotes"
      : sectionId === "irregular"
        ? "irregularReport"
        : "lostAndFound";

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
            <th className="text-left px-3 py-2 font-semibold text-[var(--foreground)] w-[9rem] whitespace-nowrap">
              日付
            </th>
            <th className="text-left px-3 py-2 font-semibold text-[var(--foreground)]">
              内容
            </th>
          </tr>
        </thead>
        <tbody>
          {days.map((date) => {
            const fields = textByDate[date];
            const text = fields?.[textKey] ?? "";
            const hasReport = Boolean(fields);

            return (
              <tr
                key={date}
                className="border-b border-[var(--border)]/60 hover:bg-[var(--muted)]/40 align-top"
              >
                <td className="px-3 py-2 text-xs text-[var(--muted-foreground)] whitespace-nowrap">
                  {formatDateLabel(date)}
                </td>
                <td className="px-3 py-2 text-sm text-[var(--foreground)]">
                  {!hasReport ? (
                    <span className="text-[var(--muted-foreground)]">—</span>
                  ) : text ? (
                    <p className="whitespace-pre-wrap">{text}</p>
                  ) : (
                    <span className="text-[var(--muted-foreground)]">（未記載）</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
