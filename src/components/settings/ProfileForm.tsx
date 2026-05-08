"use client";

import { useState, useTransition } from "react";

interface ProfileFormProps {
  initialFullName:     string;
  initialDepartment:   string;
  email:               string;
  updateProfileAction: (formData: FormData) => Promise<void>;
  updatePasswordAction:(formData: FormData) => Promise<void>;
}

export function ProfileForm({
  initialFullName,
  initialDepartment,
  email,
  updateProfileAction,
  updatePasswordAction,
}: ProfileFormProps) {
  const [fullName,    setFullName]    = useState(initialFullName);
  const [department,  setDepartment]  = useState(initialDepartment);
  const [profileMsg,  setProfileMsg]  = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPw,   setConfirmPw]   = useState("");
  const [pwMsg,       setPwMsg]       = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [isProfilePending, startProfileUpdate] = useTransition();
  const [isPwPending,      startPwUpdate]      = useTransition();

  const handleProfileSave = () => {
    setProfileMsg(null);
    const fd = new FormData();
    fd.set("full_name",   fullName);
    fd.set("department",  department);
    startProfileUpdate(async () => {
      try {
        await updateProfileAction(fd);
        setProfileMsg({ type: "success", text: "プロフィールを更新しました" });
      } catch (e) {
        setProfileMsg({ type: "error", text: e instanceof Error ? e.message : "更新に失敗しました" });
      }
    });
  };

  const handlePasswordSave = () => {
    setPwMsg(null);
    const fd = new FormData();
    fd.set("new_password",     newPassword);
    fd.set("confirm_password", confirmPw);
    startPwUpdate(async () => {
      try {
        await updatePasswordAction(fd);
        setPwMsg({ type: "success", text: "パスワードを変更しました" });
        setNewPassword("");
        setConfirmPw("");
      } catch (e) {
        setPwMsg({ type: "error", text: e instanceof Error ? e.message : "変更に失敗しました" });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* ─── プロフィール編集 ─── */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-[var(--foreground)]">プロフィール情報</h2>

        <div className="space-y-3">
          {/* メール（変更不可） */}
          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">メールアドレス</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--muted)] text-[var(--muted-foreground)] cursor-not-allowed"
            />
          </div>

          {/* 表示名 */}
          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">表示名（氏名）</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="例: 山田 太郎"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>

          {/* 部署 */}
          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">部署・役職</label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="例: 運営スタッフ"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>

        {profileMsg && (
          <p className={`text-xs font-medium ${profileMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {profileMsg.type === "success" ? "✓ " : "✗ "}{profileMsg.text}
          </p>
        )}

        <button
          type="button"
          onClick={handleProfileSave}
          disabled={isProfilePending}
          className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {isProfilePending ? "保存中..." : "変更を保存"}
        </button>
      </div>

      {/* ─── パスワード変更 ─── */}
      <div className="bg-[var(--card)] border border-[var(--border)] rounded-xl p-5 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-[var(--foreground)]">パスワード変更</h2>

        <div className="space-y-3">
          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">新しいパスワード（8文字以上）</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="新しいパスワード"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
          <div>
            <label className="block text-xs text-[var(--muted-foreground)] mb-1">パスワード（確認）</label>
            <input
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              placeholder="もう一度入力"
              className="w-full px-3 py-2 border border-[var(--border)] rounded-lg text-sm bg-[var(--background)] text-[var(--foreground)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
            />
          </div>
        </div>

        {pwMsg && (
          <p className={`text-xs font-medium ${pwMsg.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {pwMsg.type === "success" ? "✓ " : "✗ "}{pwMsg.text}
          </p>
        )}

        <button
          type="button"
          onClick={handlePasswordSave}
          disabled={isPwPending || !newPassword}
          className="px-4 py-2 bg-[var(--primary)] text-white text-sm font-medium rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {isPwPending ? "変更中..." : "パスワードを変更"}
        </button>
      </div>
    </div>
  );
}
