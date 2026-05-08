"use client";

import { useRef, useState } from "react";
import { CsvTicketImporter } from "./CsvTicketImporter";

interface ReportFormProps {
  action: (formData: FormData) => Promise<void>;
  defaultDate?: string;
  error?: string;
}

function today(): string {
  return new Date().toISOString().split("T")[0];
}

export function ReportForm({ action, defaultDate, error }: ReportFormProps) {
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const [showImporter, setShowImporter] = useState(false);

  function handleInsertFromCsv(text: string) {
    const textarea = contentRef.current;
    if (!textarea) return;
    const current = textarea.value;
    const separator = current.trim() ? "\n\n" : "";
    textarea.value = current + separator + text;
    setShowImporter(false);
    textarea.scrollTop = textarea.scrollHeight;
  }

  return (
    // Server Action フォームとCSVインポーターUIを分離するため外側をdivで包む
    <div className="space-y-5">
      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {decodeURIComponent(error)}
        </div>
      )}

      {/* 日付 */}
      <div>
        <label htmlFor="report_date" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
          日付 <span className="text-red-500">*</span>
        </label>
        <input
          id="report_date"
          name="report_date"
          form="report-form"
          type="date"
          required
          defaultValue={defaultDate ?? today()}
          className="px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
        />
      </div>

      {/* タイトル */}
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
          タイトル <span className="text-red-500">*</span>
        </label>
        <input
          id="title"
          name="title"
          form="report-form"
          type="text"
          required
          maxLength={100}
          placeholder="例: Netflixイカゲーム 05/06 販売実績"
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
        />
      </div>

      {/* CSVインポートトグルボタン（formの外） */}
      <div className="flex items-center justify-between">
        <label htmlFor="content" className="block text-sm font-medium text-[var(--foreground)]">
          内容 <span className="text-red-500">*</span>
        </label>
        <button
          type="button"
          onClick={() => setShowImporter((v) => !v)}
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
            showImporter
              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
              : "border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          CSVから取り込む
        </button>
      </div>

      {/* CSVインポーター（formの外で展開） */}
      {showImporter && (
        <CsvTicketImporter onInsert={handleInsertFromCsv} />
      )}

      {/* textarea + 送信ボタンだけ form に入れる */}
      <form id="report-form" action={action}>
        <textarea
          ref={contentRef}
          id="content"
          name="content"
          required
          rows={12}
          placeholder={`【本日の作業】\n・\n\n【成果・進捗】\n・\n\n【課題・明日の予定】\n・`}
          className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition resize-y font-mono leading-relaxed"
        />
        <div className="flex items-center justify-end gap-3 mt-4">
          <button
            type="submit"
            name="action"
            value="draft"
            className="px-4 py-2 border border-[var(--border)] text-[var(--foreground)] text-sm font-medium rounded-lg hover:bg-[var(--muted)] transition-colors"
          >
            下書き保存
          </button>
          <button
            type="submit"
            name="action"
            value="submit"
            className="px-5 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
          >
            提出する
          </button>
        </div>
      </form>
    </div>
  );
}
