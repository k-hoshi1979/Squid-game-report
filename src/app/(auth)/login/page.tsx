import type { Metadata } from "next";
import { login, signup } from "./actions";

export const metadata: Metadata = { title: "ログイン | 日報管理" };

interface LoginPageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--background)] px-4">
      <div className="w-full max-w-md">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-[var(--primary)] rounded-xl mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">日報管理</h1>
          <p className="text-sm text-[var(--muted-foreground)] mt-1">
            アカウントにサインインしてください
          </p>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm overflow-hidden">
          {/* タブ */}
          <div className="grid grid-cols-2 border-b border-[var(--border)]">
            <label className="relative cursor-pointer">
              <input type="radio" name="tab" value="login" className="peer sr-only" defaultChecked />
              <span className="block text-center py-3 text-sm font-medium text-[var(--muted-foreground)] peer-checked:text-[var(--primary)] peer-checked:border-b-2 peer-checked:border-[var(--primary)] transition-colors">
                ログイン
              </span>
            </label>
            <label className="relative cursor-pointer">
              <input type="radio" name="tab" value="signup" className="peer sr-only" />
              <span className="block text-center py-3 text-sm font-medium text-[var(--muted-foreground)] peer-checked:text-[var(--primary)] peer-checked:border-b-2 peer-checked:border-[var(--primary)] transition-colors">
                新規登録
              </span>
            </label>
          </div>

          <div className="p-6 space-y-6">
            {/* ログインフォーム */}
            <form action={login} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  メールアドレス
                </label>
                <input
                  id="login-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="login-password" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  パスワード
                </label>
                <input
                  id="login-password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 active:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
              >
                ログイン
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[var(--border)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 bg-[var(--card)] text-xs text-[var(--muted-foreground)]">または</span>
              </div>
            </div>

            {/* 新規登録フォーム */}
            <form action={signup} className="space-y-4">
              <div>
                <label htmlFor="signup-name" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  氏名
                </label>
                <input
                  id="signup-name"
                  name="full_name"
                  type="text"
                  autoComplete="name"
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
                  placeholder="山田 太郎"
                />
              </div>
              <div>
                <label htmlFor="signup-email" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  メールアドレス
                </label>
                <input
                  id="signup-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label htmlFor="signup-password" className="block text-sm font-medium text-[var(--foreground)] mb-1.5">
                  パスワード <span className="text-[var(--muted-foreground)] font-normal">(6文字以上)</span>
                </label>
                <input
                  id="signup-password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] placeholder:text-[var(--muted-foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:border-transparent transition"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2.5 border border-[var(--primary)] text-[var(--primary)] text-sm font-medium rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 active:bg-blue-100 transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2"
              >
                アカウント作成
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
