"use server";

// 2026-06-10 — admin 콘솔의 Gemini API KEY 평문 저장소 server actions.
//
// SERVER 엔드포인트:
//   GET    /api/v1/admin/gemini/keys-store               목록 (마스킹)
//   POST   /api/v1/admin/gemini/keys-store               등록 (apiKey 평문)
//   DELETE /api/v1/admin/gemini/keys-store/:id           soft disable
//   GET    /api/v1/admin/gemini/keys-store/usage-summary 총 사용량 + 키별 분포 + cap 대비 비율
//
// 평문 KEY 는 등록 호출 1회만 통과 — 응답 / 목록에는 prefix 4자 + alias 만.

import { readSession } from "@/lib/authCookie";
import {
  listGeminiKeysStore,
  addGeminiKeysStore,
  disableGeminiKeysStore,
  geminiKeysStoreUsageSummary,
  type GeminiKeysStoreItem,
  type GeminiKeysStoreUsageSummary,
} from "@/lib/adminApi";

export type AdminActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code?: string; message: string };

export async function listKeysStoreAction(): Promise<AdminActionResult<{ items: GeminiKeysStoreItem[] }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listGeminiKeysStore({ jwt });
  if (!res.ok) return { ok: false, code: res.code, message: res.message };
  return { ok: true, data: { items: res.data.items || [] } };
}

export async function addKeyStoreAction(
  apiKey: string,
): Promise<AdminActionResult<{ item: GeminiKeysStoreItem; reactivated?: boolean }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const trimmed = String(apiKey || "").trim();
  if (!trimmed) return { ok: false, message: "API KEY 가 비어 있습니다" };
  // 2026-06-10 — Google API KEY shape 확장 (AIza... / AQ.... / 그 외 Google-style).
  //   서버 KEY_SHAPE 와 정합 (영문자 시작 + [A-Za-z0-9._-] 조합 20자 이상). 상한 256자.
  if (!/^[A-Za-z][A-Za-z0-9._-]{19,}$/.test(trimmed) || trimmed.length > 256) {
    return { ok: false, message: "API KEY 형식이 올바르지 않습니다 (예: AIza... 또는 AQ....)" };
  }
  const res = await addGeminiKeysStore({ jwt, apiKey: trimmed });
  if (!res.ok) {
    return { ok: false, code: res.code, message: friendlyKeyStoreMessage(res.code, res.message) };
  }
  return { ok: true, data: { item: res.data.item, reactivated: res.data.reactivated } };
}

// 2026-06-10 — KEY 등록/해제 실패 시 raw server message 대신 친화 메시지로 매핑.
//   ERR_DEPENDENCY_UNAVAILABLE (GEMINI_KEY_STORE_SECRET 미설정),
//   ERR_VALIDATION, ERR_CONFLICT, ERR_NOT_FOUND, ERR_FORBIDDEN 등.
function friendlyKeyStoreMessage(code: string | undefined, raw: string): string {
  switch (code) {
    case "ERR_KEY_STORE_NOT_CONFIGURED":
    case "ERR_DEPENDENCY_UNAVAILABLE":
      return "암호화 키가 설정되지 않았습니다. 운영자에게 GEMINI_KEY_STORE_SECRET 환경변수 설정을 요청하세요.";
    case "ERR_VALIDATION":
      return "API KEY 형식이 올바르지 않습니다.";
    case "ERR_CONFLICT":
      return "이미 등록된 KEY 입니다.";
    case "ERR_NOT_FOUND":
      return "대상 KEY 를 찾을 수 없습니다.";
    case "ERR_FORBIDDEN":
    case "ERR_NOT_AUTHORIZED":
    case "ERR_OPERATOR_NOT_AUTHORIZED":
      return "이 작업을 수행할 권한이 없습니다.";
    case "ERR_OPERATOR_AUTH_EXPIRED":
    case "ERR_AUTH_EXPIRED":
      return "세션이 만료되었습니다. 다시 로그인해주세요.";
    case "ERR_SERVER_UNAVAILABLE":
    case "ERR_INTERNAL":
      return "일시적인 서버 오류입니다. 잠시 후 다시 시도하세요.";
    case "ERR_NETWORK":
      return "네트워크 연결을 확인해주세요.";
    default:
      return raw && raw.length > 0 ? raw : "처리 중 오류가 발생했습니다.";
  }
}

export async function disableKeyStoreAction(
  id: string,
): Promise<AdminActionResult<{ item: GeminiKeysStoreItem }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const trimmed = String(id || "").trim();
  if (!trimmed) return { ok: false, message: "id 누락" };
  const res = await disableGeminiKeysStore({ jwt, id: trimmed });
  if (!res.ok) {
    return { ok: false, code: res.code, message: friendlyKeyStoreMessage(res.code, res.message) };
  }
  return { ok: true, data: { item: res.data.item } };
}

export async function keysStoreUsageSummaryAction(
  range: "24h" | "7d" | "30d" = "30d",
): Promise<AdminActionResult<GeminiKeysStoreUsageSummary>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await geminiKeysStoreUsageSummary({ jwt, range });
  if (!res.ok) return { ok: false, code: res.code, message: res.message };
  return { ok: true, data: res.data };
}
