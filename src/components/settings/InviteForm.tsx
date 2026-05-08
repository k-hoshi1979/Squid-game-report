"use client";

import { useState, useTransition } from "react";

interface InviteFormProps {
  inviteAction: (formData: FormData) => Promise<void>;
}

export function InviteForm({ inviteAction }: InviteFormProps) {
  const [email,     setEmail]     = useState("");
  const [message,   setMessage]   = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleInvite = () => {
    if (!email.trim()) return;
    setMessage(null);
    const fd = new FormData();
    fd.set("email", email.trim());
    startTransition(async () => {
      try {
        await inviteAction(fd);
        setMessage({ type: "success", text: `${email} に招待メールを送信しました` });
        setEmail("");
      } catch (e) {
        setMessage({ type: "error", text: e instanceof Error ? e.message : "招待に失敗しました" });
      }
    });
  };

  return (
    <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
      <div>
        <h2 className="text-sm font-bold text-[var(--foreground)] mb-1">メンバーを招待</h2>
        <p className="text-xs text-[var(--muted-foreground)]">
          メールアドレスを入力すると、招待リンク付きのメールが送信されます。
          受信者がリンクをクリックしてパスワードを設定すると、ログインできるようになります。
        </p>
      </div>

      <div className="flex gap-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setMessage(null); }}
          onKeyDown={(e) => { if (e.key === "Enter") handleInvite(); }}
          placeholder="例: staff@example.com"
          className="flex-1 px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
        />
        <button
          type="button"
          onClick={handleInvite}
          disabled={isPending || !email.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
        >
          {isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              送信中...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
              招待メールを送る
            </>
          )}
        </button>
      </div>

      {message && (
        <p className={`text-xs font-medium ${message.type === "success" ? "text-green-600" : "text-red-600"}`}>
          {message.type === "success" ? "✓ " : "✗ "}{message.text}
        </p>
      )}
    </div>
  );
}
