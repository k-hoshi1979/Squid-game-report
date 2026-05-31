import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildMallProPdf } from "@/lib/export-data/buildMallProPdf";
import { buildMallProData } from "@/lib/export-data/mallProData";
import { parseReportContent } from "@/types/report";

export const runtime = "nodejs";

function isValidDate(raw: string | null): raw is string {
  return Boolean(raw && /^\d{4}-\d{2}-\d{2}$/.test(raw));
}

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get("date");

  if (!isValidDate(date)) {
    return NextResponse.json({ error: "日付（YYYY-MM-DD）を指定してください" }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
  }

  const { data: report, error } = await supabase
    .from("daily_reports")
    .select("report_date, content")
    .eq("report_date", date)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!report) {
    return NextResponse.json({ error: "指定日の日報が見つかりません" }, { status: 404 });
  }

  const parsed = parseReportContent(report.content);
  if (!parsed) {
    return NextResponse.json({ error: "日報データの形式が不正です" }, { status: 422 });
  }

  try {
    const mallData = buildMallProData(date, parsed);
    const pdf = await buildMallProPdf(mallData);
    const filename = encodeURIComponent(`モールプロ添付_${date}.pdf`);

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDFの生成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
