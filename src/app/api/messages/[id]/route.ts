import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/types/database";

type MessageCategory = Database["public"]["Enums"]["message_category"];

function getAdminOrNull() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

// DELETE /api/messages/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const userName =
      profile?.full_name ?? profile?.email ?? user.email ?? "不明";

    // 本人かつ未削除のみ（ユーザー権限・RLS 下で確認）
    const { data: message, error: fetchErr } = await supabase
      .from("messages")
      .select("content, category")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!message) {
      return NextResponse.json(
        {
          error:
            "メッセージが見つかりません（既に削除済みか権限がありません）",
        },
        { status: 404 }
      );
    }

    const admin = getAdminOrNull();
    const db = admin ?? supabase;

    if (!admin) {
      console.warn(
        "[api/messages] SUPABASE_SERVICE_ROLE_KEY 未設定のため RLS 下で更新します"
      );
    }

    const { error: logErr } = await db.from("message_logs").insert({
      message_id: id,
      user_id: user.id,
      user_name: userName,
      action: "deleted",
      content_snapshot: message.content,
      category_snapshot: message.category,
    });
    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 });
    }

    const { error: updateErr } = await db
      .from("messages")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "サーバーエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/messages/[id] — 編集
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "認証が必要です" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", user.id)
      .maybeSingle();

    const userName =
      profile?.full_name ?? profile?.email ?? user.email ?? "不明";

    const body = (await req.json()) as {
      category?: string;
      content?: string;
    };
    const category = body.category?.trim();
    const content = body.content?.trim();

    if (!content) {
      return NextResponse.json(
        { error: "内容を入力してください" },
        { status: 400 }
      );
    }

    const VALID: MessageCategory[] = [
      "confirmation",
      "request",
      "notice",
      "other",
    ];
    if (!category || !VALID.includes(category as MessageCategory)) {
      return NextResponse.json(
        { error: "カテゴリが無効です" },
        { status: 400 }
      );
    }
    const cat = category as MessageCategory;

    const { data: original, error: fetchErr } = await supabase
      .from("messages")
      .select("content, category")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 500 });
    }
    if (!original) {
      return NextResponse.json(
        { error: "メッセージが見つかりません" },
        { status: 404 }
      );
    }

    const admin = getAdminOrNull();
    const db = admin ?? supabase;

    if (!admin) {
      console.warn(
        "[api/messages] SUPABASE_SERVICE_ROLE_KEY 未設定のため RLS 下で更新します"
      );
    }

    const { error: updateErr } = await db
      .from("messages")
      .update({ category: cat, content })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    const { error: logErr } = await db.from("message_logs").insert({
      message_id: id,
      user_id: user.id,
      user_name: userName,
      action: "edited",
      content_snapshot: original.content,
      category_snapshot: original.category,
    });
    if (logErr) {
      return NextResponse.json({ error: logErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "サーバーエラー";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
