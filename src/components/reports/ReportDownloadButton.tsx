"use client";

import { useState } from "react";

type Period = "daily" | "weekly" | "monthly";
type ExportFormat = "summary" | "ticket-items";
type ExportLayout = "vertical" | "horizontal";

const PERIOD_TABS: { id: Period; label: string; desc: string }[] = [
  { id: "daily",   label: "日別",  desc: "指定日1日分" },
  { id: "weekly",  label: "週間",  desc: "指定日を含む週（月〜日）" },
  { id: "monthly", label: "月間",  desc: "指定日を含む月（全日）" },
];

const FORMAT_TABS: { id: ExportFormat; label: string; desc: string }[] = [
  { id: "summary",      label: "日報サマリー", desc: "特典・リテール・IB等を含む全体" },
  {
    id: "ticket-items",
    label: "実績管理表",
    desc: "リテール→ジャージ→チケット→IB の順（Excel へコピペ向け）",
  },
];

const LAYOUT_TABS: { id: ExportLayout; label: string; desc: string }[] = [
  { id: "vertical",   label: "縦並び", desc: "「値」列をコピーして実績管理表に貼り付け" },
  { id: "horizontal", label: "横並び", desc: "1日1行（月間一括向け）" },
];

function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function ReportDownloadButton() {
  const [period, setPeriod]       = useState<Period>("daily");
  const [format, setFormat]       = useState<ExportFormat>("ticket-items");
  const [layout, setLayout]       = useState<ExportLayout>("vertical");
  const [baseDate, setBaseDate]   = useState(todayStr());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        period,
        date: baseDate,
        format,
      });
      if (format === "ticket-items") {
        params.set("layout", layout);
      }
      const res = await fetch(`/api/reports/download?${params}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;\r\n"]+)/i);
      const rawName = match?.[1] ?? "daily-reports.csv";
      const filename = decodeURIComponent(rawName);

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ダウンロードに失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  const activeTab = PERIOD_TABS.find((t) => t.id === period)!;
  const activeFormat = FORMAT_TABS.find((t) => t.id === format)!;
  const activeLayout = LAYOUT_TABS.find((t) => t.id === layout)!;

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-4">
        <svg className="w-4 h-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <h3 className="text-sm font-bold text-[var(--foreground)]">CSV ダウンロード</h3>
      </div>

      {/* 出力形式 */}
      <div className="mb-4">
        <p className="text-xs text-[var(--muted-foreground)] mb-2">出力形式</p>
        <div className="flex items-center gap-1 p-1 bg-[var(--muted)] rounded-lg w-fit flex-wrap">
          {FORMAT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFormat(tab.id)}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                format === tab.id
                  ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">{activeFormat.desc}</p>
      </div>

      {format === "ticket-items" && (
        <div className="mb-4">
          <p className="text-xs text-[var(--muted-foreground)] mb-2">レイアウト</p>
          <div className="flex items-center gap-1 p-1 bg-[var(--muted)] rounded-lg w-fit flex-wrap">
            {LAYOUT_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setLayout(tab.id)}
                className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
                  layout === tab.id
                    ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[var(--muted-foreground)]">{activeLayout.desc}</p>
        </div>
      )}

      {/* 期間タブ */}
      <div className="flex items-center gap-1 p-1 bg-[var(--muted)] rounded-lg mb-4 w-fit">
        {PERIOD_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setPeriod(tab.id)}
            className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${
              period === tab.id
                ? "bg-[var(--card)] text-[var(--foreground)] shadow-sm"
                : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 日付選択 */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-[var(--muted-foreground)] mb-1">
            基準日 <span className="text-[var(--muted-foreground)] font-normal">— {activeTab.desc}</span>
          </label>
          <input
            type="date"
            defaultValue={baseDate}
            onChange={(e) => setBaseDate(e.target.value)}
            className="px-3 py-1.5 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
          />
        </div>

        <button
          onClick={handleDownload}
          disabled={isLoading || !baseDate}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              生成中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              ダウンロード
            </>
          )}
        </button>
      </div>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      {format === "ticket-items" && layout === "vertical" && (
        <p className="mt-3 text-xs text-[var(--muted-foreground)]">
          ※ Excel で開き、「値」列をコピーして貼り付け。並び順はリテール売上 → ジャージレンタル → チケット売上 → IB対応チケットです。
        </p>
      )}

      <p className="mt-2 text-xs text-[var(--muted-foreground)]">
        ※ UTF-8 BOM 付きのため Excel で文字化けしません
      </p>
    </div>
  );
}
