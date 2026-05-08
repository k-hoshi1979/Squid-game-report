import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface CalendarReport {
  id:     string;
  date:   string;   // YYYY-MM-DD
  status: string;   // submitted | revised | confirmed
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year  = parseInt(searchParams.get("year")  ?? String(new Date().getFullYear()), 10);
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1), 10);

  const p2 = (n: number) => String(n).padStart(2, "0");
  const start = `${year}-${p2(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end     = `${year}-${p2(month)}-${p2(lastDay)}`;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("daily_reports")
      .select("id, report_date, status")
      .eq("user_id", user.id)
      .gte("report_date", start)
      .lte("report_date", end)
      .in("status", ["submitted", "revised", "confirmed"])
      .order("report_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const reports: CalendarReport[] = (data ?? []).map((r) => ({
      id:     r.id,
      date:   r.report_date,
      status: r.status,
    }));

    return NextResponse.json({ reports });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
