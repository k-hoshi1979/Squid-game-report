import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Header } from "@/components/layout/Header";
import { ProfileForm } from "@/components/settings/ProfileForm";
import { updateProfile, updatePassword } from "./actions";

export const metadata: Metadata = { title: "設定" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, department, avatar_url")
    .eq("id", user!.id)
    .single();

  return (
    <>
      <Header title="設定" />

      <main className="flex-1 p-3 sm:p-6 max-w-2xl mx-auto w-full space-y-6">
        {/* サブナビ */}
        <div className="flex gap-2 border-b border-[var(--border)] pb-3">
          <span className="px-3 py-1.5 text-sm font-semibold text-[var(--primary)] border-b-2 border-[var(--primary)] -mb-3">
            プロフィール
          </span>
          <Link
            href="/settings/members"
            className="px-3 py-1.5 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
          >
            メンバー管理
          </Link>
        </div>

        {/* アバター＋名前の見出し */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-2xl font-bold shrink-0">
            {(profile?.full_name ?? profile?.email ?? "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-lg font-semibold text-[var(--foreground)]">
              {profile?.full_name ?? "（名前未設定）"}
            </p>
            <p className="text-sm text-[var(--muted-foreground)]">{profile?.email}</p>
          </div>
        </div>

        {/* プロフィール編集フォーム */}
        <ProfileForm
          initialFullName={profile?.full_name ?? ""}
          initialDepartment={profile?.department ?? ""}
          email={profile?.email ?? ""}
          updateProfileAction={updateProfile}
          updatePasswordAction={updatePassword}
        />
      </main>
    </>
  );
}
