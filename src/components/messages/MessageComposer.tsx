"use client";

import { useState, useTransition } from "react";
import type { MessageCategory } from "@/types/message";
import { CATEGORY_CONFIG } from "@/types/message";

const CATEGORIES: MessageCategory[] = ["confirmation", "request", "notice", "other"];

interface MessageComposerProps {
  createAction: (formData: FormData) => Promise<void>;
}

export function MessageComposer({ createAction }: MessageComposerProps) {
  const [isOpen,    setIsOpen]    = useState(false);
  const [category,  setCategory]  = useState<MessageCategory>("notice");
  const [content,   setContent]   = useState("");
  const [error,     setError]     = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!content.trim()) { setError("内容を入力してください"); return; }
    setError(null);
    const fd = new FormData();
    fd.set("category", category);
    fd.set("content",  content.trim());
    startTransition(async () => {
      try {
        await createAction(fd);
        setContent("");
        setCategory("notice");
        setIsOpen(false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "投稿に失敗しました");
      }
    });
  };

  const handleCancel = () => {
    setIsOpen(false);
    setContent("");
    setCategory("notice");
    setError(null);
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl shadow-sm overflow-hidden">
      {/* 折りたたみトグル */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--muted)] transition-colors group"
        >
          <div className="w-8 h-8 rounded-full border-2 border-dashed border-[var(--border)] flex items-center justify-center group-hover:border-[var(--primary)] transition-colors">
            <svg className="w-4 h-4 text-[var(--muted-foreground)] group-hover:text-[var(--primary)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <span className="text-sm text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors">
            申送りを投稿する
          </span>
        </button>
      ) : (
        <div className="p-4 space-y-3">
          {/* ヘッダー */}
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-[var(--foreground)]">新規申送り</p>
            <button
              type="button"
              onClick={handleCancel}
              className="w-6 h-6 flex items-center justify-center rounded-md text-[var(--muted-foreground)] hover:bg-[var(--muted)] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* カテゴリ選択 */}
          <div>
            <p className="text-xs text-[var(--muted-foreground)] mb-2">種別</p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => {
                const cfg = CATEGORY_CONFIG[cat];
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-bold border transition-colors ${
                      category === cat
                        ? `${cfg.bgColor} ${cfg.textColor} ${cfg.borderColor}`
                        : "bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* テキストエリア */}
          <div>
            <p className="text-xs text-[var(--muted-foreground)] mb-2">
              内容
              <span className="ml-1 text-[var(--muted-foreground)] font-normal">（URLはリンクになります）</span>
            </p>
            <textarea
              value={content}
              onChange={(e) => { setContent(e.target.value); setError(null); }}
              rows={4}
              maxLength={2000}
              placeholder="申送り内容を入力してください"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] resize-y"
            />
            <div className="flex justify-between mt-1">
              <span className="text-xs text-[var(--muted-foreground)]">{content.length} / 2000</span>
              {error && <p className="text-xs text-red-600">{error}</p>}
            </div>
          </div>

          {/* 送信ボタン */}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-[var(--border)] text-[var(--muted-foreground)] text-sm rounded-lg hover:bg-[var(--muted)] transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending || !content.trim()}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isPending ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  投稿中...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                  投稿する
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
