// B21 — 어드민 자체 route handler.
// `app/dashboard/knowledge/page.tsx` 가 호출하는 도달 확인용 ping.
// 기존에는 미구현 상태로 UI 가 항상 "미도달" 표시.

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
