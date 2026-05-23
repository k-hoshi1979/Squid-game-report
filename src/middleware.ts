import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Next が読み込むファイル名・関数名である必要があります（旧 proxy.ts は未適用だった） */
export async function middleware(request: NextRequest) {
  const response = await updateSession(request);
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
