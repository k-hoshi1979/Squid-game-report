import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildItemListNumericExportCsv,
  buildItemListTextExportCsv,
  itemListExportFilename,
  parseItemListExportSections,
} from "@/lib/report/buildItemListExportCsv";
import type { ItemListExportCategory } from "@/lib/report/itemListSpec";
import { monthDateRange } from "@/lib/report/extractItemValues";

function isValidYearMonth(raw: string | null): raw is string {
  return Boolean(raw && /^\d{4}-\d{2}$/.test(raw));
}

function parseCategory(raw: string | null): ItemListExportCategory | null {
  if (raw === "numeric" || raw === "text") return raw;
  return null;
}

export async function GET(request: NextRequest) {
  const month = request.nextUrl.searchParams.get("month");
  const categoryParam = request.nextUrl.searchParams.get("category");
  const sectionsParam = request.nextUrl.searchParams.get("sections");

  if (!isValidYearMonth(month)) {
    return NextResponse.json(
      { error: "月（YYYY-MM）を指定してください" },
      { status: 400 },
    );
  }

  const category = parseCategory(categoryParam);
  if (!category) {
    return NextResponse.json(
      { error: "category（numeric または text）を指定してください" },
      { status: 400 },
    );
  }

  const sectionIds = parseItemListExportSections(sectionsParam, category);
  const { start, end } = monthDateRange(month);

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data: reports, error } = await supabase
      .from("daily_reports")
      .select("report_date, content")
      .gte("report_date", start)
      .lte("report_date", end)
      .order("report_date", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const csv =
      category === "numeric"
        ? buildItemListNumericExportCsv(reports ?? [], month, sectionIds)
        : buildItemListTextExportCsv(reports ?? [], month, sectionIds);
    const filename = itemListExportFilename(month, category);

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
