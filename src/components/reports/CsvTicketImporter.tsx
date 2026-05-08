"use client";

import { useRef, useState } from "react";
import {
  decodeShiftJis,
  parseTicketCsv,
  formatTicketSummary,
  type CsvParseResult,
} from "@/lib/csv/parseTicketCsv";

interface CsvTicketImporterProps {
  onInsert: (text: string) => void;
  /** CSVパース結果をそのまま受け取りたい場合に指定 */
  onData?: (data: CsvParseResult) => void;
}

function fmt(n: number) {
  return new Intl.NumberFormat("ja-JP").format(n);
}

export function CsvTicketImporter({ onInsert, onData }: CsvTicketImporterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<CsvParseResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);
    setFileName(file.name);

    try {
      const buffer = await file.arrayBuffer();
      // Shift-JIS / UTF-8 を自動判定して変換
      let text: string;
      try {
        text = decodeShiftJis(buffer);
        // Shift-JIS で文字化けしていたら UTF-8 を試みる
        if (text.includes("�")) {
          text = new TextDecoder("utf-8").decode(buffer);
        }
      } catch {
        text = new TextDecoder("utf-8").decode(buffer);
      }

      const parsed = parseTicketCsv(text);
      if (parsed.rows.length === 0) {
        setError(
          "集計できる販売データが見つかりませんでした。CSVの形式を確認してください。"
        );
      } else {
        setResult(parsed);
        // onData が渡されている場合はデータを直接渡す（ReportNewForm用）
        if (onData) onData(parsed);
      }
    } catch (e) {
      setError("ファイルの読み込みに失敗しました: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function handleDrop(e: React.DragEvent<HTMLElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  }

  function handleInsert() {
    if (!result) return;
    onInsert(formatTicketSummary(result));
  }

  function handleReset() {
    setResult(null);
    setError(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--muted)] overflow-hidden">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)] bg-[var(--card)]">
        <svg className="w-4 h-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span className="text-sm font-medium text-[var(--foreground)]">CSVからチケット販売データを取り込む</span>
        {result && (
          <button
            type="button"
            onClick={handleReset}
            className="ml-auto text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            クリア
          </button>
        )}
      </div>

      <div className="p-4 space-y-4">
        {/* ドロップゾーン */}
        {!result && (
          <label
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="block border-2 border-dashed border-[var(--border)] rounded-lg p-6 text-center cursor-pointer hover:border-[var(--primary)] hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors"
          >
            {/* input を label の中に直接置く（暗黙的な関連付け）*/}
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="sr-only"
            />
            {loading ? (
              <div className="flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-[var(--muted-foreground)]">読み込み中...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <svg className="w-8 h-8 text-[var(--muted-foreground)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-[var(--muted-foreground)]">
                  CSVをここにドロップ、または
                  <span className="text-[var(--primary)] font-medium ml-1">クリックして選択</span>
                </p>
                <p className="text-xs text-[var(--muted-foreground)]">Shift-JIS / UTF-8 どちらにも対応</p>
              </div>
            )}
          </label>
        )}

        {/* エラー */}
        {error && (
          <div className="px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        {/* 集計プレビュー */}
        {result && (
          <div className="space-y-3">
            {/* ファイル名 */}
            <p className="text-xs text-[var(--muted-foreground)] flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
              {fileName}
            </p>

            {/* イベント情報 */}
            <div className="bg-[var(--card)] rounded-lg p-3 border border-[var(--border)] text-xs space-y-0.5">
              <p className="font-medium text-[var(--foreground)]">{result.eventName}</p>
              <p className="text-[var(--muted-foreground)]">{result.venue}</p>
              <p className="text-[var(--muted-foreground)]">
                {result.datetimes.length}枠 ({result.datetimes[0]}
                {result.datetimes.length > 1 ? ` 〜 ${result.datetimes[result.datetimes.length - 1]}` : ""})
              </p>
            </div>

            {/* 受付名グループ別集計テーブル */}
            <div className="space-y-3">
              {result.groups.map((group) => (
                <div key={group.receptionName} className="bg-[var(--card)] rounded-lg border border-[var(--border)] overflow-hidden">
                  {/* グループヘッダー（受付名） */}
                  <div className="px-3 py-2 bg-[var(--muted)] border-b border-[var(--border)]">
                    <span className="text-xs font-bold text-[var(--foreground)]">▼ {group.receptionName}</span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]">販売区分</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]">単価</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]">枚数</th>
                        <th className="text-right px-3 py-1.5 text-xs font-medium text-[var(--muted-foreground)]">金額</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {group.rows.map((row) => (
                        <tr key={row.ticketType} className="hover:bg-[var(--muted)]/50">
                          <td className="px-3 py-1.5 text-[var(--foreground)]">{row.ticketType}</td>
                          <td className="px-3 py-1.5 text-right text-[var(--muted-foreground)]">
                            {row.unitPrice > 0 ? `¥${fmt(row.unitPrice)}` : "—"}
                          </td>
                          <td className="px-3 py-1.5 text-right font-medium text-[var(--foreground)]">{fmt(row.count)}枚</td>
                          <td className="px-3 py-1.5 text-right font-medium text-[var(--foreground)]">
                            {row.amount > 0 ? `¥${fmt(row.amount)}` : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[var(--border)] bg-blue-50/30 dark:bg-blue-900/5">
                        <td colSpan={2} className="px-3 py-1.5 text-xs font-bold text-[var(--muted-foreground)]">小計</td>
                        <td className="px-3 py-1.5 text-right text-sm font-bold text-[var(--primary)]">{fmt(group.subtotalCount)}枚</td>
                        <td className="px-3 py-1.5 text-right text-sm font-bold text-[var(--primary)]">¥{fmt(group.subtotalAmount)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              ))}

              {/* 総合計 */}
              <div className="bg-blue-50 dark:bg-blue-900/10 border-2 border-blue-200 dark:border-blue-700 rounded-lg px-4 py-2.5 flex justify-between items-center">
                <span className="text-sm font-bold text-[var(--foreground)]">合計</span>
                <div className="text-right">
                  <span className="text-sm font-bold text-[var(--primary)]">{fmt(result.totalCount)}枚</span>
                  <span className="ml-3 text-sm font-bold text-[var(--primary)]">¥{fmt(result.totalAmount)}</span>
                </div>
              </div>
            </div>

            {/* 挿入ボタン */}
            <button
              type="button"
              onClick={handleInsert}
              className="w-full py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              この集計を日報の内容に挿入する
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
