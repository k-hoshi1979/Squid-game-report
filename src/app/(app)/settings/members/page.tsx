import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { Header } from "@/components/layout/Header";
import { InviteForm } from "@/components/settings/InviteForm";
import { inviteMember } from "./actions";

export const metadata: Metadata = { title: "メンバー管理" };

export default async function MembersPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // 全プロフィール一覧（全ユーザーがプロフィールを持つ前提）
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, department, created_at")
    .order("created_at", { ascending: true });

  // 招待中（未承認）ユーザーを admin クライアントで取得
  let pendingInvites: { id: string; email: string; created_at: string }[] = [];
  try {
    const admin = createAdminClient();
    const { data: authUsers } = await admin.auth.admin.listUsers();
    const confirmedIds = new Set((profiles ?? []).map((p) => p.id));
    pendingInvites = (authUsers?.users ?? [])
      .filter((u) => !confirmedIds.has(u.id) && u.email && !u.email_confirmed_at)
      .map((u) => ({ id: u.id, email: u.email!, created_at: u.created_at }));
  } catch {
    // Service role key が未設定の場合は空リスト
  }

  return (
    <>
      <Header title="設定" />

      <main className="flex-1 p-3 sm:p-6 max-w-2xl mx-auto w-full space-y-6">
        {/* サブナビ */}
        <div className="flex gap-2 border-b border-[var(--border)] pb-3">
          <Link
            href="/settings"
            className="px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            プロフィール
          </Link>
          <span className="px-3 py-1.5 text-sm font-semibold text-[var(--primary)] border-b-2 border-[var(--primary)] -mb-3">
            メンバー管理
          </span>
        </div>

        {/* 招待フォーム */}
        <InviteForm inviteAction={inviteMember} />

        {/* 招待中（未承認） */}
        {pendingInvites.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
              招待中（未承認）
            </h2>
            <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
              {pendingInvites.map((invite, i) => (
                <div
                  key={invite.id}
                  className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-[var(--border)]" : ""}`}
                >
                  <div className="w-8 h-8 rounded-full bg-[var(--muted)] flex items-center justify-center text-[var(--muted-foreground)] text-xs font-bold">
                    ?
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--foreground)] truncate">{invite.email}</p>
                    <p className="text-xs text-[var(--muted-foreground)]">招待済み・未承認</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400 font-medium">
                    保留中
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 登録済みメンバー一覧 */}
        <section>
          <h2 className="text-sm font-bold text-[var(--muted-foreground)] uppercase tracking-wider mb-3">
            登録済みメンバー ({(profiles ?? []).length}名)
          </h2>
          <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl overflow-hidden">
            {(profiles ?? []).length === 0 ? (
              <p className="text-sm text-[var(--muted-foreground)] p-4">メンバーがいません</p>
            ) : (
              (profiles ?? []).map((profile, i) => {
                const isMe      = profile.id === user.id;
                const initial   = (profile.full_name ?? profile.email).charAt(0).toUpperCase();
                return (
                  <div
                    key={profile.id}
                    className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-[var(--border)]" : ""}`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[var(--foreground)] truncate">
                          {profile.full_name ?? "（名前未設定）"}
                        </p>
                        {isMe && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400 font-medium">
                            自分
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--muted-foreground)] truncate">
                        {profile.email}
                        {profile.department && ` · ${profile.department}`}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400 font-medium">
                      有効
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>
    </>
  );
}
