"use client";

import { useState, useTransition } from "react";
import { deleteReport } from "@/app/(app)/reports/[id]/edit/actions";

interface DeleteReportButtonProps {
  reportId: string;
  reportTitle: string;
}

export function DeleteReportButton({ reportId, reportTitle }: DeleteReportButtonProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);

  const handleDelete = () => {
    setServerError(null);
    startTransition(async () => {
      const result = await deleteReport(reportId);
      if (result?.error) {
        setServerError(result.error);
        setShowDialog(false);
      }
    });
  };

  return (
    <>
      {/* 削除ボタン */}
      <button
        type="button"
        onClick={() => setShowDialog(true)}
        className="inline-flex items-center gap-2 px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        削除
      </button>

      {/* サーバーエラー */}
      {serverError && (
        <p className="text-sm text-red-600 dark:text-red-400">{serverError}</p>
      )}

      {/* 確認ダイアログ */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* オーバーレイ */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowDialog(false)}
          />

          {/* ダイアログ本体 */}
          <div className="relative z-10 bg-[var(--card)] border border-[var(--border)] rounded-2xl shadow-xl w-full max-w-sm p-6">
            {/* アイコン */}
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 mx-auto mb-4">
              <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>

            <h2 className="text-base font-bold text-[var(--foreground)] text-center mb-2">
              日報を削除しますか？
            </h2>
            <p className="text-sm text-[var(--muted-foreground)] text-center mb-1">
              「{reportTitle}」を削除します。
            </p>
            <p className="text-xs text-red-500 text-center mb-6 font-medium">
              この操作は元に戻せません。
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowDialog(false)}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 border border-[var(--border)] text-[var(--foreground)] text-sm font-medium rounded-lg hover:bg-[var(--muted)] transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isPending}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isPending ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    削除中...
                  </>
                ) : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
