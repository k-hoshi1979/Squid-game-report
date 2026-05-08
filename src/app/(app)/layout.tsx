import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNavDrawer } from "@/components/layout/MobileNavDrawer";
import { createClient } from "@/lib/supabase/server";

async function getUserDisplay() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();

    const name  = profile?.full_name ?? "";
    const email = profile?.email ?? user.email ?? "";
    const initial = (name || email).charAt(0).toUpperCase();
    return { name, email, initial };
  } catch {
    return null;
  }
}

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userDisplay = await getUserDisplay();

  return (
    <div className="flex min-h-screen bg-[var(--background)]">
      {/* ─── サイドバー: md以上で表示 ─── */}
      <Sidebar />

      <div className="flex-1 flex flex-col min-w-0">
        {/* ─── モバイル用スティッキートップバー (md未満のみ表示) ─── */}
        <div className="md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 h-14 bg-[var(--card)] border-b border-[var(--border)]">
          <MobileNavDrawer userDisplay={userDisplay} />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[var(--primary)] rounded-md flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="font-semibold text-sm text-[var(--foreground)]">日報管理</span>
          </div>
        </div>

        {/* ─── ページコンテンツ ─── */}
        {children}
      </div>
    </div>
  );
}
