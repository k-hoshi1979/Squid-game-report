import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { MessageCard } from "@/components/messages/MessageCard";
import { MessageComposer } from "@/components/messages/MessageComposer";
import { createMessage } from "./actions";
import type { MessageWithAuthor, MessageLog, MessageCategory } from "@/types/message";
import { CATEGORY_CONFIG } from "@/types/message";

export const metadata: Metadata = { title: "申送り" };

const FILTER_ITEMS: { value: MessageCategory | "all"; label: string }[] = [
  { value: "all",          label: "すべて" },
  { value: "confirmation", label: "確認" },
  { value: "request",      label: "依頼" },
  { value: "notice",       label: "連絡" },
  { value: "other",        label: "その他" },
];

interface MessagesPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function MessagesPage({ searchParams }: MessagesPageProps) {
  const { category } = await searchParams;
  const activeCategory = (category as MessageCategory | undefined) ?? "all";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // メッセージ一覧（profiles JOIN は FK が auth.users 向きのため別クエリで取得）
  let query = supabase
    .from("messages")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(100);

  if (activeCategory !== "all") {
    query = query.eq("category", activeCategory);
  }

  const { data: rawMessages } = await query;
  const baseMessages = (rawMessages ?? []) as unknown as import("@/types/message").Message[];

  // 投稿者プロフィールを別途取得してマージ
  const userIds = [...new Set(baseMessages.map((m) => m.user_id))];
  const { data: profileRows } = userIds.length > 0
    ? await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds)
    : { data: [] };

  const profileMap = new Map(
    (profileRows ?? []).map((p) => [p.id, p as { id: string; full_name: string | null; email: string }])
  );

  const messages: MessageWithAuthor[] = baseMessages.map((m) => ({
    ...m,
    profiles: profileMap.get(m.user_id) ?? null,
  }));

  // 操作ログを一括取得
  const messageIds = messages.map((m) => m.id);
  const { data: rawLogs } = messageIds.length > 0
    ? await supabase
        .from("message_logs")
        .select("*")
        .in("message_id", messageIds)
        .order("performed_at", { ascending: true })
    : { data: [] };

  const logsMap = new Map<string, MessageLog[]>();
  for (const log of (rawLogs ?? []) as MessageLog[]) {
    const list = logsMap.get(log.message_id) ?? [];
    list.push(log);
    logsMap.set(log.message_id, list);
  }

  return (
    <>
      <Header title="申送り" />

      <main className="flex-1 p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* カテゴリフィルター */}
        <div className="flex items-center gap-2 flex-wrap">
          {FILTER_ITEMS.map(({ value, label }) => {
            const href     = value === "all" ? "/messages" : `/messages?category=${value}`;
            const isActive = activeCategory === value;
            const catCfg   = value !== "all" ? CATEGORY_CONFIG[value as MessageCategory] : null;
            return (
              <Link
                key={value}
                href={href}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? catCfg
                      ? `${catCfg.bgColor} ${catCfg.textColor} border ${catCfg.borderColor}`
                      : "bg-[var(--primary)] text-white"
                    : "bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] hover:bg-[var(--muted)]"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* 新規投稿コンポーザー */}
        <MessageComposer createAction={createMessage} />

        {/* メッセージ一覧 */}
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <svg className="w-12 h-12 text-[var(--muted-foreground)] opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <p className="text-sm text-[var(--muted-foreground)]">申送りメッセージはまだありません</p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <MessageCard
                key={message.id}
                message={message}
                logs={logsMap.get(message.id) ?? []}
                currentUserId={user!.id}
              />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
