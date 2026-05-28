"use client";

import { useState } from "react";
import type { ExportDataMenu } from "@/lib/export-data/menus";

function todayStr() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

interface ExportDataMenuCardProps {
  menu: ExportDataMenu;
  index: number;
}

export function ExportDataMenuCard({ menu, index }: ExportDataMenuCardProps) {
  const [date, setDate] = useState(todayStr());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ date });
      const res = await fetch(`${menu.apiPath}?${params}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;\r\n"]+)/i);
      const rawName = match?.[1] ?? `${menu.title}_${date}.pdf`;
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

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 bg-[var(--muted)] border-b border-[var(--border)] flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs font-bold shrink-0">
          {index}
        </span>
        <h2 className="text-sm font-bold text-[var(--foreground)]">{menu.title}</h2>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        <p className="text-sm text-[var(--muted-foreground)]">{menu.description}</p>

        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <div className="flex-1">
            <label
              htmlFor={`export-date-${menu.id}`}
              className="block text-sm font-medium text-[var(--foreground)] mb-1.5"
            >
              日報の日付
            </label>
            <input
              id={`export-date-${menu.id}`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <button
            type="button"
            disabled={isLoading || !date}
            onClick={handleDownload}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 10v6m0 0l-3-3m3 3l3-3M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {isLoading ? "生成中..." : "PDFをダウンロード"}
          </button>
        </div>

        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
