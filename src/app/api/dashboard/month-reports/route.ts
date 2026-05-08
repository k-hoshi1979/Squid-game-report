import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface DashboardReportLite {
  id: string;
  report_date: string;
  status: string;
  content: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const monthParam = searchParams.get("month"); // YYYY-MM
  const fromParam  = searchParams.get("from"); // YYYY-MM-DD inclusive
  const toParam    = searchParams.get("to"); // YYYY-MM-DD inclusive

  const now = new Date();
  const p2 = (n: number) => String(n).padStart(2, "0");

  let start: string;
  let end: string;

  if (
    fromParam &&
    toParam &&
    ISO_DATE_RE.test(fromParam) &&
    ISO_DATE_RE.test(toParam)
  ) {
    start = fromParam <= toParam ? fromParam : toParam;
    end = fromParam <= toParam ? toParam : fromParam;
  } else {
    const year = monthParam ? Number(monthParam.slice(0, 4)) : now.getFullYear();
    const month = monthParam ? Number(monthParam.slice(5, 7)) : now.getMonth() + 1;
    start = `${year}-${p2(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    end = `${year}-${p2(month)}-${p2(lastDay)}`;
  }

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
