import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface DashboardReportLite {
  id: string;
  report_date: string;
  status: string;
  content: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // YYYY-MM

  const now = new Date();
  const year = monthParam ? Number(monthParam.slice(0, 4)) : now.getFullYear();
  const month = monthParam ? Number(monthParam.slice(5, 7)) : now.getMonth() + 1;

  const p2 = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${p2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${p2(month)}-${p2(lastDay)}`;

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("daily_reports")
      .select("id, report_date, status, content")
      .eq("user_id", user.id)
      .gte("report_date", start)
      .lte("report_date", end)
      .in("status", ["submitted", "revised", "confirmed"])
      .order("report_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ reports: (data ?? []) as DashboardReportLite[] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
