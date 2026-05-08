"use client";

import { useState, useTransition } from "react";
import { confirmReport } from "@/app/(app)/reports/[id]/actions";

interface ConfirmReportButtonProps {
  reportId: string;
}

export function ConfirmReportButton({ reportId }: ConfirmReportButtonProps) {
  const [showPanel, setShowPanel] = useState(false);
  const [confirmerName, setConfirmerName] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await confirmReport(reportId, confirmerName);
      if (result?.error) {
        setError(result.error);
      }
      // 成功時は revalidatePath でサーバーが再レンダリングされパネルが消える
    });
  };

  if (!showPanel) {
    return (
      <button
        type="button"
        onClick={() => setShowPanel(true)}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 active:scale-95 transition-all shadow-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        確認する
      </button>
    );
  }

  return (
    <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-700 rounded-xl p-4 space-y-3">
      <p className="text-sm font-semibold text-green-800 dark:text-green-300 flex items-center gap-2">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        確認者名を入力して確定してください
      </p>

      <input
        type="text"
        value={confirmerName}
        onChange={(e) => setConfirmerName(e.target.value)}
        placeholder="例：田中 花子"
        autoFocus
        className="w-full px-3 py-2 border border-green-300 dark:border-green-600 rounded-lg text-sm bg-white dark:bg-green-900/20 text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-green-500"
      />

      {error && (
        <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => { setShowPanel(false); setError(null); setConfirmerName(""); }}
          disabled={isPending}
          className="px-4 py-2 border border-[var(--border)] text-[var(--muted-foreground)] text-sm font-medium rounded-lg hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
        >
          キャンセル
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isPending || !confirmerName.trim()}
          className="flex-1 px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isPending ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              処理中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              確定する
            </>
          )}
        </button>
      </div>
    </div>
  );
}
