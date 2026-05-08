"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MessageWithAuthor, MessageLog, MessageCategory } from "@/types/message";
import { CATEGORY_CONFIG } from "@/types/message";

// ─── URL を自動リンク化 ────────────────────────────────────────

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/gi);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^https?:\/\//i.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all">{part}</a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ─── 日時フォーマット（クライアントのみ） ─────────────────────

function ClientDate({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(
      new Intl.DateTimeFormat("ja-JP", {
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit", timeZone: "Asia/Tokyo",
      }).format(new Date(iso))
    );
  }, [iso]);
  return <span suppressHydrationWarning>{label}</span>;
}

const ACTION_LABEL: Record<string, string> = {
  created: "投稿", edited: "編集", deleted: "削除",
};

// ─── カテゴリバッジ ───────────────────────────────────────────

function CategoryBadge({ category }: { category: MessageCategory }) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`}>
      {cfg.label}
    </span>
  );
}

const CATEGORIES: MessageCategory[] = ["confirmation", "request", "notice", "other"];

// ─── 削除確認モーダル ─────────────────────────────────────────

interface DeleteModalProps {
  isDeleting: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

function DeleteModal({ isDeleting, error, onConfirm, onCancel }: DeleteModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* 背景オーバーレイ */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* モーダル本体 */}
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl p-6 w-full max-w-sm space-y-4">
        {/* アイコン */}
        <div className="flex items-center justify-center w-12 h-12 mx-auto rounded-full bg-red-100 dark:bg-red-900/30">
          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </div>

        <div className="text-center space-y-1">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">メッセージを削除しますか？</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">この操作は取り消せません。</p>
        </div>

        {error && (
          <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 px-4 py-3">
            <p className="text-sm text-red-700 dark:text-red-400 font-medium">エラー: {error}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          >
            いいえ
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors"
          >
            {isDeleting ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                削除中...
              </span>
            ) : "はい、削除する"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MessageCard ─────────────────────────────────────────────

interface MessageCardProps {
  message:       MessageWithAuthor;
  logs:          MessageLog[];
  currentUserId: string;
}

export function MessageCard({ message, logs, currentUserId }: MessageCardProps) {
  const router   = useRouter();
  const isOwner  = currentUserId === message.user_id;

  const [isEditing,    setIsEditing]    = useState(false);
  const [showLogs,     setShowLogs]     = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [editCategory, setEditCategory] = useState<MessageCategory>(message.category);
  const [editContent,  setEditContent]  = useState(message.content);
  const [editError,    setEditError]    = useState<string | null>(null);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);
  const [isUpdating,   setIsUpdating]   = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(false);

  const authorName = message.profiles?.full_name ?? message.profiles?.email ?? "不明";
  const wasEdited  = message.updated_at !== message.created_at;

  // ─── 更新 ───────────────────────────────────────────────────

  const handleUpdate = async () => {
    if (!editContent.trim()) { setEditError("内容を入力してください"); return; }
    setEditError(null);
    setIsUpdating(true);
    try {
      const res = await fetch(`/api/messages/${message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: editCategory, content: editContent }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "更新に失敗しました");
      setIsEditing(false);
      router.refresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setIsUpdating(false);
    }
  };

  // ─── 削除 ───────────────────────────────────────────────────

  const handleDeleteConfirm = async () => {
    setDeleteError(null);
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/messages/${message.id}`, { method: "DELETE" });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "削除に失敗しました");
      setShowDeleteModal(false);
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "削除に失敗しました");
      setIsDeleting(false);
    }
  };

  return (
    <>
      {/* 削除確認モーダル */}
      {showDeleteModal && (
        <DeleteModal
          isDeleting={isDeleting}
          error={deleteError}
          onConfirm={handleDeleteConfirm}
          onCancel={() => { if (!isDeleting) { setShowDeleteModal(false); setDeleteError(null); } }}
        />
      )}

      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
        {/* ─── ヘッダー ─── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border)] bg-[var(--muted)]/40">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {authorName.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium text-[var(--foreground)]">{authorName}</span>
            <ClientDate iso={message.created_at} />
            {wasEdited && (
              <span className="text-xs text-[var(--muted-foreground)] italic">（編集済み）</span>
            )}
          </div>

          <CategoryBadge category={message.category} />
        </div>

        {/* ─── 本文 / 編集フォーム ─── */}
        <div className="px-4 py-3">
          {isEditing ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map((cat) => {
                  const cfg = CATEGORY_CONFIG[cat];
                  return (
                    <button key={cat} type="button" onClick={() => setEditCategory(cat)}
                      className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        editCategory === cat
                          ? `${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`
                          : "bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                      }`}>
                      {cfg.label}
                    </button>
                  );
                })}
              </div>

              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={4} maxLength={2000}
                className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--muted-foreground)]">{editContent.length}/2000</span>
                {editError && <p className="text-xs text-red-600">{editError}</p>}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={handleUpdate} disabled={isUpdating}
                  className="px-4 py-1.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors">
                  {isUpdating ? "保存中..." : "保存する"}
                </button>
                <button type="button"
                  onClick={() => { setIsEditing(false); setEditContent(message.content); setEditCategory(message.category); setEditError(null); }}
                  className="px-4 py-1.5 border border-[var(--border)] text-[var(--muted-foreground)] text-sm rounded-lg hover:bg-[var(--muted)] transition-colors">
                  キャンセル
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--foreground)] leading-relaxed">
              <LinkifiedText text={message.content} />
            </p>
          )}
        </div>

        {/* ─── フッター ─── */}
        {!isEditing && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border)]/60">
            <button type="button" onClick={() => setShowLogs((v) => !v)}
              className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors">
              <svg className={`w-3.5 h-3.5 transition-transform ${showLogs ? "rotate-90" : ""}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
              変更履歴 ({logs.length})
            </button>

            {isOwner && (
              <div className="flex items-center gap-1">
                {/* 編集ボタン */}
                <button type="button" onClick={() => setIsEditing(true)}
                  className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                  title="編集">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* 削除ボタン → モーダルを開く */}
                <button type="button" onClick={() => { setDeleteError(null); setShowDeleteModal(true); }}
                  className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="削除">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            )}
          </div>
        )}

        {/* ─── 変更履歴パネル ─── */}
        {showLogs && (
          <div className="border-t border-[var(--border)] bg-[var(--muted)]/30 px-4 py-3 space-y-2">
            <p className="text-xs font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-2">変更履歴</p>
            {logs.length === 0 ? (
              <p className="text-xs text-[var(--muted-foreground)]">履歴はありません</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex items-start gap-2 text-xs text-[var(--muted-foreground)]">
                  <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold ${
                    log.action === "created" ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400"
                    : log.action === "edited"  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400"
                    : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400"
                  }`}>
                    {ACTION_LABEL[log.action]}
                  </span>
                  <span className="font-medium text-[var(--foreground)]">{log.user_name}</span>
                  <ClientDate iso={log.performed_at} />
                  {log.action === "edited" && log.content_snapshot && (
                    <span className="text-[var(--muted-foreground)] truncate max-w-[200px]" title={log.content_snapshot}>
                      変更前: {log.content_snapshot.slice(0, 40)}{log.content_snapshot.length > 40 ? "…" : ""}
                    </span>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </>
  );
}
