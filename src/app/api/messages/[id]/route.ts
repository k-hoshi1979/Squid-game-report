import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DELETE /api/messages/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    // プロフィール取得
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    const userName = profile?.full_name ?? profile?.email ?? user.email ?? "不明";

    // 対象メッセージ確認（自分の投稿か）
    const { data: message } = await supabase
      .from("messages")
      .select("content, category")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!message) {
      return NextResponse.json(
        { error: "メッセージが見つかりません（既に削除済みか権限がありません）" },
        { status: 404 }
      );
    }

    // 削除ログを先に記録
    await supabase.from("message_logs").insert({
      message_id:        id,
      user_id:           user.id,
      user_name:         userName,
      action:            "deleted",
      content_snapshot:  message.content,
      category_snapshot: message.category,
    });

    // ソフトデリート
    const { error: updateError } = await supabase
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "サーバーエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/messages/[id]  — 編集
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .single();
    const userName = profile?.full_name ?? profile?.email ?? user.email ?? "不明";

    const body = await req.json() as { category?: string; content?: string };
    const category = body.category?.trim();
    const content  = body.content?.trim();

    if (!content) return NextResponse.json({ error: "内容を入力してください" }, { status: 400 });

    const VALID = ["confirmation", "request", "notice", "other"];
    if (!category || !VALID.includes(category)) {
      return NextResponse.json({ error: "カテゴリが無効です" }, { status: 400 });
    }

    const { data: original } = await supabase
      .from("messages")
      .select("content, category")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .single();

    if (!original) {
      return NextResponse.json({ error: "メッセージが見つかりません" }, { status: 404 });
    }

    const { error: updateError } = await supabase
      .from("messages")
      .update({ category: category as "confirmation" | "request" | "notice" | "other", content })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

    await supabase.from("message_logs").insert({
      message_id:        id,
      user_id:           user.id,
      user_name:         userName,
      action:            "edited",
      content_snapshot:  original.content,
      category_snapshot: original.category as "confirmation" | "request" | "notice" | "other",
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "サーバーエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
