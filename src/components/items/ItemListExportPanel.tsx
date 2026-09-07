"use client";

import { useState } from "react";
import {
  ITEM_LIST_SECTIONS,
  type ItemListSectionId,
} from "@/lib/report/itemListSpec";

const DEFAULT_SECTION_IDS: ItemListSectionId[] = ITEM_LIST_SECTIONS.map(
  (section) => section.id,
);

interface ItemListExportPanelProps {
  yearMonth: string;
}

export function ItemListExportPanel({ yearMonth }: ItemListExportPanelProps) {
  const [selectedSections, setSelectedSections] =
    useState<ItemListSectionId[]>(DEFAULT_SECTION_IDS);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSection = (sectionId: ItemListSectionId) => {
    setSelectedSections((current) =>
      current.includes(sectionId)
        ? current.filter((id) => id !== sectionId)
        : [...current, sectionId],
    );
  };

  const handleDownload = async () => {
    if (selectedSections.length === 0) {
      setError("出力する項目を1つ以上選択してください");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        month: yearMonth,
        sections: selectedSections.join(","),
      });
      const res = await fetch(`/api/items/export?${params}`);

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }

      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename\*?=(?:UTF-8'')?([^;\r\n"]+)/i);
      const rawName = match?.[1] ?? "item-list.csv";
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
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="text-sm font-bold text-[var(--foreground)]">
            CSV 抽出
          </h2>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            表示中の月（{yearMonth.replace("-", "年")}月）の項目一覧を、タブの並び順どおりに出力します。
          </p>
        </div>
        <button
          type="button"
          onClick={handleDownload}
          disabled={isLoading || selectedSections.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? "生成中..." : "CSVダウンロード"}
        </button>
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-[var(--muted-foreground)] mb-2">
          出力する項目
        </legend>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          {ITEM_LIST_SECTIONS.map((section) => {
            const checked = selectedSections.includes(section.id);
            return (
              <label
                key={section.id}
                className="inline-flex items-center gap-2 text-sm text-[var(--foreground)] cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleSection(section.id)}
                  className="rounded border-[var(--border)] text-[var(--primary)] focus:ring-[var(--primary)]"
                />
                {section.tabLabel}
              </label>
            );
          })}
        </div>
      </fieldset>

      {error && (
        <p className="mt-3 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <p className="mt-3 text-xs text-[var(--muted-foreground)]">
        ※ 数値項目は「項目・月間合計・日付列」、テキスト項目は「日付・内容」の形式で出力します（UTF-8 BOM 付き）。
      </p>
    </div>
  );
}
