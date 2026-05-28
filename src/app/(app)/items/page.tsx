import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { ItemListTable } from "@/components/items/ItemListTable";
import {
  buildSnsByDate,
  buildTextByDate,
  buildValuesByDate,
  currentYearMonth,
  monthDateRange,
} from "@/lib/report/extractItemValues";
import {
  getSectionById,
  parseSectionId,
} from "@/lib/report/itemListSpec";

export const metadata: Metadata = { title: "項目一覧" };

export const dynamic = "force-dynamic";

interface ItemsPageProps {
  searchParams: Promise<{ month?: string; section?: string }>;
}

function parseYearMonth(raw: string | undefined): string {
  if (raw && /^\d{4}-\d{2}$/.test(raw)) return raw;
  return currentYearMonth();
}

export default async function ItemsPage({ searchParams }: ItemsPageProps) {
  const { month: monthParam, section: sectionParam } = await searchParams;
  const yearMonth = parseYearMonth(monthParam);
  const sectionId = parseSectionId(sectionParam);
  const section = getSectionById(sectionId);
  const { start, end, days } = monthDateRange(yearMonth);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: reports, error } = await supabase
    .from("daily_reports")
    .select("report_date, content")
    .eq("user_id", user!.id)
    .gte("report_date", start)
    .lte("report_date", end)
    .order("report_date", { ascending: true });

  const valuesByDate = buildValuesByDate(reports ?? []);
  const snsByDate = buildSnsByDate(reports ?? []);
  const textByDate = buildTextByDate(reports ?? []);
  const reportCount = Object.keys(valuesByDate).length;

  return (
    <>
      <Header
        title="項目一覧"
        description={`${yearMonth.replace("-", "年")}月 — ${section.tabLabel}（${reportCount}日分の日報）`}
      />

      <main className="flex-1 p-3 sm:p-6">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            データの取得に失敗しました: {error.message}
          </div>
        )}

        {!error && reportCount === 0 && (
          <div className="mb-4 px-4 py-3 bg-[var(--muted)] border border-[var(--border)] rounded-lg text-sm text-[var(--muted-foreground)]">
            この月の日報はまだありません。
          </div>
        )}

        <ItemListTable
          yearMonth={yearMonth}
          sectionId={sectionId}
          days={days}
          valuesByDate={valuesByDate}
          snsByDate={snsByDate}
          textByDate={textByDate}
        />
      </main>
    </>
  );
}
