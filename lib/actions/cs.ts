"use server";

// V1.0 #7 — CS 통합 조회 server action.
//
// Server: GET /api/v1/admin/cs/lookup?q=
// 호출 시 JWT 는 httpOnly 쿠키에서만 읽어 client 노출 차단.
//
// 본 action 은 검색어를 POST 본문으로 받아 Server 에 GET 으로 위임한다
// (브라우저 URL 에 PII 노출 방지). 결과는 page.tsx 가 4분면 카드로 렌더.

import { readSession } from "@/lib/authCookie";
import { csLookup, type CsLookupResult } from "@/lib/adminApi";

export type CsLookupActionResult =
  | { ok: true; result: CsLookupResult }
  | { ok: false; message: string; code?: string };

export async function csLookupAction(
  formData: FormData,
): Promise<CsLookupActionResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다. 다시 로그인하세요." };

  const q = String(formData.get("q") || "").trim();
  if (q.length < 3) {
    return {
      ok: false,
      message: "검색어는 3자 이상 입력하세요 (이메일/시리얼/UUID).",
    };
  }

  const res = await csLookup({ jwt, q });
  if (!res.ok) {
    return {
      ok: false,
      message: res.message || "Server 조회 실패",
      code: res.code,
    };
  }
  return { ok: true, result: res.data };
}
