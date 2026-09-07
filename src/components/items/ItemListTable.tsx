"use client";

import { useRouter } from "next/navigation";
import {
  ITEM_LIST_SECTIONS,
  getSectionById,
  sumTicketValuesAcrossDays,
  sumTicketValuesForDate,
  type ItemListSectionId,
} from "@/lib/report/itemListSpec";
import {
  formatDateLabel,
  formatDayHeader,
  type ItemListTextFields,
} from "@/lib/report/extractItemValues";
import { ItemListExportPanel } from "@/components/items/ItemListExportPanel";

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

/** 表示中の日付列を横断した合計（月間合計） */
function sumAcrossDays(
  days: string[],
  valuesByDate: Record<string, number[]>,
  valueIndex: number,
): number {
  let sum = 0;
  for (const date of days) {
    const value = valuesByDate[date]?.[valueIndex];
    if (value !== undefined) sum += value;
  }
  return sum;
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
      <ItemListExportPanel yearMonth={yearMonth} />

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
            ? sectionId === "ticket"
              ? "項目を縦軸、月間合計と日付（昇順）を横軸に表示しています。先頭のチケット合計は全券種の日次合算です。特典・貸切VIPは当日販売数（出数）です。"
              : "項目を縦軸、月間合計と日付（昇順）を横軸に表示しています。"
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

function resolveNumericCellValue(
  sectionId: ItemListSectionId,
  labelIndex: number,
  date: string | null,
  days: string[],
  valuesByDate: Record<string, number[]>,
): number | undefined {
  if (sectionId === "ticket" && labelIndex === 0) {
    if (date) {
      const values = valuesByDate[date];
      return values ? sumTicketValuesForDate(values) : undefined;
    }
    return sumTicketValuesAcrossDays(days, valuesByDate);
  }

  const section = getSectionById(sectionId);
  const valueIndex =
    sectionId === "ticket"
      ? labelIndex - 1
      : sectionId === "sns"
        ? labelIndex
        : section.rowOffset + labelIndex;

  if (date) {
    return valuesByDate[date]?.[valueIndex];
  }

  return sumAcrossDays(days, valuesByDate, valueIndex);
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
  const sectionId = section.id;
  return (
    <div className="overflow-x-auto">
      <table className="w-max min-w-full text-sm border-collapse">
        <thead>
          <tr className="bg-[var(--muted)] border-b border-[var(--border)]">
            <th className="sticky left-0 z-20 bg-[var(--muted)] text-left px-3 py-2 font-semibold text-[var(--foreground)] min-w-[12rem] max-w-[20rem] border-r border-[var(--border)]">
              項目
            </th>
            <th className="sticky left-[12rem] z-20 bg-[var(--muted)] px-2 py-2 text-center font-semibold text-[var(--foreground)] min-w-[4.5rem] whitespace-nowrap border-r border-[var(--border)]">
              月間合計
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
              section.id === "ticket" && labelIndex === 0
                ? "total"
                : section.id === "sns"
                  ? labelIndex
                  : section.id === "ticket"
                    ? labelIndex - 1
                    : section.rowOffset + labelIndex;
            return (
              <tr
                key={`${section.id}-${String(valueIndex)}`}
                className="border-b border-[var(--border)]/60 hover:bg-[var(--muted)]/40"
              >
                <td className="sticky left-0 z-10 bg-[var(--card)] px-3 py-1.5 text-xs text-[var(--foreground)] border-r border-[var(--border)] max-w-[20rem]">
                  {label}
                </td>
                <td className="sticky left-[12rem] z-10 bg-[var(--card)] px-2 py-1.5 text-right tabular-nums text-xs font-semibold text-[var(--primary)] border-r border-[var(--border)]">
                  {formatCell(
                    resolveNumericCellValue(
                      sectionId,
                      labelIndex,
                      null,
                      days,
                      valuesByDate,
                    ),
                  )}
                </td>
                {days.map((date) => {
                  const value = resolveNumericCellValue(
                    sectionId,
                    labelIndex,
                    date,
                    days,
                    valuesByDate,
                  );
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
