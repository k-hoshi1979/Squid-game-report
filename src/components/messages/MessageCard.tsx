"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { MessageWithAuthor, MessageLog, MessageCategory } from "@/types/message";
import { CATEGORY_CONFIG } from "@/types/message";
import { deleteMessage, updateMessage } from "@/app/(app)/messages/actions";

// ─── URL を自動リンク化 ─────────────────────────────────────────

function LinkifiedText({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s]+)/gi);
  return (
    <span className="whitespace-pre-wrap break-words">
      {parts.map((part, i) =>
        /^https?:\/\//i.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-500 hover:underline break-all"
          >
            {part}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

// ─── 日時フォーマット（クライアントのみ・ハイドレーション不一致を回避）─

function ClientDate({ iso }: { iso: string }) {
  const [label, setLabel] = useState("");
  useEffect(() => {
    setLabel(
      new Intl.DateTimeFormat("ja-JP", {
        year:     "numeric",
        month:    "2-digit",
        day:      "2-digit",
        hour:     "2-digit",
        minute:   "2-digit",
        timeZone: "Asia/Tokyo",
      }).format(new Date(iso))
    );
  }, [iso]);
  return <span suppressHydrationWarning>{label}</span>;
}

const ACTION_LABEL: Record<string, string> = {
  created: "投稿",
  edited:  "編集",
  deleted: "削除",
};

// ─── カテゴリバッジ ─────────────────────────────────────────────

function CategoryBadge({ category }: { category: MessageCategory }) {
  const cfg = CATEGORY_CONFIG[category];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border ${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`}>
      {cfg.label}
    </span>
  );
}

// ─── カテゴリ選択肢 ─────────────────────────────────────────────

const CATEGORIES: MessageCategory[] = ["confirmation", "request", "notice", "other"];

// ─── MessageCard ───────────────────────────────────────────────

interface MessageCardProps {
  message:       MessageWithAuthor;
  logs:          MessageLog[];
  currentUserId: string;
}

export function MessageCard({ message, logs, currentUserId }: MessageCardProps) {
  const isOwner = currentUserId === message.user_id;

  const router = useRouter();

  const [isEditing,    setIsEditing]    = useState(false);
  const [showLogs,     setShowLogs]     = useState(false);
  const [showDelete,   setShowDelete]   = useState(false);
  const [editCategory, setEditCategory] = useState<MessageCategory>(message.category);
  const [editContent,  setEditContent]  = useState(message.content);
  const [editError,    setEditError]    = useState<string | null>(null);
  const [deleteError,  setDeleteError]  = useState<string | null>(null);
  const [isUpdatePending, setIsUpdatePending] = useState(false);
  const [isDeletePending, setIsDeletePending] = useState(false);

  const authorName = message.profiles?.full_name ?? message.profiles?.email ?? "不明";
  const wasEdited  = message.updated_at !== message.created_at;

  const handleUpdate = async () => {
    if (!editContent.trim()) { setEditError("内容を入力してください"); return; }
    setEditError(null);
    setIsUpdatePending(true);
    const fd = new FormData();
    fd.set("category", editCategory);
    fd.set("content",  editContent);
    try {
      await updateMessage(message.id, fd);
      setIsEditing(false);
      router.refresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "更新に失敗しました");
    } finally {
      setIsUpdatePending(false);
    }
  };

  const handleDelete = async () => {
    if (isDeletePending) return;
    setDeleteError(null);
    setIsDeletePending(true);
    try {
      await deleteMessage(message.id);
      router.refresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "削除に失敗しました");
      setShowDelete(false);
      setIsDeletePending(false);
    }
  };

  return (
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
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setEditCategory(cat)}
                    className={`px-3 py-1 rounded-lg text-xs font-bold border transition-colors ${
                      editCategory === cat
                        ? `${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`
                        : "bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>

            <textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={4}
              maxLength={2000}
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--muted-foreground)]">{editContent.length}/2000</span>
              {editError && <p className="text-xs text-red-600">{editError}</p>}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleUpdate}
                disabled={isUpdatePending}
                className="px-4 py-1.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
              >
                {isUpdatePending ? "保存中..." : "保存する"}
              </button>
              <button
                type="button"
                onClick={() => { setIsEditing(false); setEditContent(message.content); setEditCategory(message.category); setEditError(null); }}
                className="px-4 py-1.5 border border-[var(--border)] text-[var(--muted-foreground)] text-sm rounded-lg hover:bg-[var(--muted)] transition-colors"
              >
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
          <button
            type="button"
            onClick={() => setShowLogs((v) => !v)}
            className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            <svg className={`w-3.5 h-3.5 transition-transform ${showLogs ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
            変更履歴 ({logs.length})
          </button>

          {isOwner && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => { setIsEditing(true); setShowDelete(false); }}
                className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-[var(--primary)] hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                title="編集"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>

              {showDelete ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-red-600 font-medium">削除しますか？</span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeletePending}
                    className="px-2 py-1 text-xs bg-red-500 text-white rounded-md hover:bg-red-600 disabled:opacity-50 transition-colors"
                  >
                    {isDeletePending ? "..." : "削除"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowDelete(false); setDeleteError(null); }}
                    className="px-2 py-1 text-xs border border-[var(--border)] text-[var(--muted-foreground)] rounded-md hover:bg-[var(--muted)] transition-colors"
                  >
                    戻す
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowDelete(true)}
                  className="p-1.5 rounded-md text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                  title="削除"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {deleteError && (
        <div className="px-4 pb-2">
          <p className="text-xs text-red-600">{deleteError}</p>
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
  );
}
