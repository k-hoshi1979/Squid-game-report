import { createClient } from "@/lib/supabase/server";
import {
  ibTicketsWithDefaults,
  jerseyRentalWithDefaults,
  type ReportData,
} from "@/types/report";

export type RetailReportPrefill = {
  jerseyRental: ReportData["jerseyRental"];
  ibTickets: ReportData["ibTickets"];
};

/** 営業日（JST 0時切り替え） */
export function getBusinessDateString(at: Date = new Date()): string {
  return at.toLocaleDateString("en-CA", { timeZone: "Asia/Tokyo" });
}

function hasPrefillData(row: {
  jersey_normal_count: number | null;
  jersey_sns_count: number | null;
  ib_gen_weekday_count: number | null;
  ib_gen_holiday_count: number | null;
  ib_child_weekday_count: number | null;
  ib_child_holiday_count: number | null;
  ib_gen_vip_weekday_count: number | null;
  ib_gen_vip_holiday_count: number | null;
  ib_child_vip_weekday_count: number | null;
  ib_child_vip_holiday_count: number | null;
  ib_vip_count: number | null;
}): boolean {
  return [
    row.jersey_normal_count,
    row.jersey_sns_count,
    row.ib_gen_weekday_count,
    row.ib_gen_holiday_count,
    row.ib_child_weekday_count,
    row.ib_child_holiday_count,
    row.ib_gen_vip_weekday_count,
    row.ib_gen_vip_holiday_count,
    row.ib_child_vip_weekday_count,
    row.ib_child_vip_holiday_count,
    row.ib_vip_count,
  ].some((n) => (n ?? 0) > 0);
}

/** RETAIL業務アプリの日次集計を日報フォーム用に取得 */
export async function fetchRetailReportPrefill(
  reportDate: string,
): Promise<RetailReportPrefill | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("retail_daily_report_export")
      .select("*")
      .eq("business_date", reportDate)
      .maybeSingle();

    if (error || !data || !hasPrefillData(data)) {
      return null;
    }

    return {
      jerseyRental: jerseyRentalWithDefaults({
        normalCount: data.jersey_normal_count ?? 0,
        snsCount: data.jersey_sns_count ?? 0,
      }),
      ibTickets: ibTicketsWithDefaults({
        genWeekday: { count: data.ib_gen_weekday_count ?? 0 },
        genHoliday: { count: data.ib_gen_holiday_count ?? 0 },
        childWeekday: { count: data.ib_child_weekday_count ?? 0 },
        childHoliday: { count: data.ib_child_holiday_count ?? 0 },
        genVipWeekday: { count: data.ib_gen_vip_weekday_count ?? 0 },
        genVipHoliday: { count: data.ib_gen_vip_holiday_count ?? 0 },
        childVipWeekday: { count: data.ib_child_vip_weekday_count ?? 0 },
        childVipHoliday: { count: data.ib_child_vip_holiday_count ?? 0 },
        vip: { count: data.ib_vip_count ?? 0 },
      } as Partial<ReportData["ibTickets"]>),
    };
  } catch {
    return null;
  }
}
