"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { MessageCategory } from "@/types/message";

/** RLS と衝突しがちな更新・ログは Service Role で行う（本人確認済みのみ）。 */
function getAdminOrThrowSupabaseFallback() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

const VALID_CATEGORIES: MessageCategory[] = ["confirmation", "request", "notice", "other"];

async function getUserAndName() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("認証が必要です");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", user.id)
    .single();

  const userName = profile?.full_name ?? profile?.email ?? user.email ?? "不明";
  return { supabase, user, userName };
}

export async function createMessage(formData: FormData) {
  const { supabase, user, userName } = await getUserAndName();

  const category = formData.get("category") as MessageCategory;
  const content  = (formData.get("content") as string | null)?.trim() ?? "";

  if (!content)                           throw new Error("内容を入力してください");
  if (!VALID_CATEGORIES.includes(category)) throw new Error("カテゴリが無効です");

  const { data: message, error } = await supabase
    .from("messages")
    .insert({ user_id: user.id, category, content })
    .select("id")
    .single();

  if (error || !message) throw new Error(error?.message ?? "作成に失敗しました");

  await supabase.from("message_logs").insert({
    message_id:        message.id,
    user_id:           user.id,
    user_name:         userName,
    action:            "created",
    content_snapshot:  content,
    category_snapshot: category,
  });

  revalidatePath("/messages");
}

export async function updateMessage(id: string, formData: FormData) {
  const { supabase, user, userName } = await getUserAndName();

  const category = formData.get("category") as MessageCategory;
  const content  = (formData.get("content") as string | null)?.trim() ?? "";

  if (!content)                           throw new Error("内容を入力してください");
  if (!VALID_CATEGORIES.includes(category)) throw new Error("カテゴリが無効です");

  // 編集前のスナップショット取得
  const { data: original } = await supabase
    .from("messages")
    .select("content, category")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (!original) throw new Error("メッセージが見つかりません");

  const db = getAdminOrThrowSupabaseFallback() ?? supabase;

  const { error } = await db
    .from("messages")
    .update({ category, content })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  const { error: logErr } = await db.from("message_logs").insert({
    message_id:        id,
    user_id:           user.id,
    user_name:         userName,
    action:            "edited",
    content_snapshot:  original.content, // 編集前の内容を記録
    category_snapshot: original.category,
  });
  if (logErr) throw new Error(logErr.message);

  revalidatePath("/messages");
}

export async function deleteMessage(id: string) {
  const { supabase, user, userName } = await getUserAndName();

  const { data: message } = await supabase
    .from("messages")
    .select("content, category")
    .eq("id", id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .single();

  if (!message) throw new Error("メッセージが見つかりません");

  const db = getAdminOrThrowSupabaseFallback() ?? supabase;

  const { error: logErr } = await db.from("message_logs").insert({
    message_id:        id,
    user_id:           user.id,
    user_name:         userName,
    action:            "deleted",
    content_snapshot:  message.content,
    category_snapshot: message.category,
  });
  if (logErr) throw new Error(logErr.message);

  const { error: delErr } = await db
    .from("messages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (delErr) throw new Error(delErr.message);

  revalidatePath("/messages");
}
