"use server";

import { readSession } from "@/lib/authCookie";
import { getAiHealth, type AiHealthSnapshot } from "@/lib/adminApi";

export type AiHealthResult =
  | { ok: true; snapshot: AiHealthSnapshot }
  | { ok: false; message: string };

/**
 * AI 호출 운영 관측 조회 — server-side. JWT 는 httpOnly 쿠키에서만 읽는다.
 *
 * Server 라우트 `GET /api/v1/admin/ai-health` (모든 operator role 허용) 와 정합.
 * Server 의 `aiHealthTracker` 5분 sliding window 통계를 반환한다 — Gemini
 * fallback rate · p50/p95/p99 latency · 모델별 분해.
 *
 * `/dashboard/ops` 의 AI 호출 모니터링 패널이 호출 — Server 도달 불가 시
 * 호출자(client)가 mock 으로 graceful degrade 할 수 있도록 ok:false 를 반환한다.
 */
export async function getAiHealthAction(): Promise<AiHealthResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다. 다시 로그인하세요." };
  const res = await getAiHealth({ jwt });
  if (!res.ok) {
    return { ok: false, message: `AI 헬스 조회 실패 (${res.code}).` };
  }
  return { ok: true, snapshot: res.data };
}
