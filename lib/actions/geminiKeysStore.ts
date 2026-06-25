"use server";

// 2026-06-10 — admin 콘솔의 Gemini API KEY 평문 저장소 server actions.
//
// SERVER 엔드포인트:
//   GET    /api/v1/admin/gemini/keys-store               목록 (마스킹)
//   POST   /api/v1/admin/gemini/keys-store               등록 (apiKey 평문)
//   PUT    /api/v1/admin/gemini/keys-store/:id/rotate    키 회전 (신규 평문 + reason)
//   DELETE /api/v1/admin/gemini/keys-store/:id           soft disable
//   GET    /api/v1/admin/gemini/keys-store/usage-summary 총 사용량 + 키별 분포 + cap 대비 비율
//
// 평문 KEY 는 등록/회전 호출 시점에만 존재 — 응답 / 목록에는 prefix 4자 + alias 만.
// 회전(rotate) 시 audit_log 1건 기록 (ai_key.rotated) + reason 5자 이상 강제.

import { createHash } from "node:crypto";
import { readSession } from "@/lib/authCookie";
import { appendAuditLog } from "@/lib/auditApi";
import {
  listGeminiKeysStore,
  addGeminiKeysStore,
  disableGeminiKeysStore,
  rotateGeminiKeysStore,
  geminiKeysStoreUsageSummary,
  type GeminiKeysStoreItem,
  type GeminiKeysStoreUsageSummary,
} from "@/lib/adminApi";

export type AdminActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; code?: string; message: string };

export async function listKeysStoreAction(): Promise<AdminActionResult<{ items: GeminiKeysStoreItem[] }>> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listGeminiKeysStore({ jwt });
  if (!res.ok) return { ok: false, code: res.code, message: res.message };
  return { ok: true, data: { items: res.data.items || [] } };
}

export async function addKeyStoreAction(
  apiKey: string,
): Promise<KeyStoreActionResult<{ item: GeminiKeysStoreItem; reactivated?: boolean }>> {
  const jwt = await readSession();
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
    const msg = friendlyKeyStoreMessage(res.code, res.message);
    // 2026-06-25 — KEK 미설정은 별도 setup_required 플래그로 분리.
    if (msg === "KEY_STORE_NOT_CONFIGURED") {
      return { ok: false, code: res.code, message: "서버 KEK 미설정", setup_required: true };
    }
    return { ok: false, code: res.code, message: msg };
  }
  return { ok: true, data: { item: res.data.item, reactivated: res.data.reactivated } };
}

// 2026-06-10 — KEY 등록/해제 실패 시 raw server message 대신 친화 메시지로 매핑.
//   ERR_DEPENDENCY_UNAVAILABLE (GEMINI_KEY_STORE_SECRET 미설정),
//   ERR_VALIDATION, ERR_CONFLICT, ERR_NOT_FOUND, ERR_FORBIDDEN 등.
//
// 2026-06-25 — KEY_STORE_NOT_CONFIGURED 에 setup_required 플래그 추가.
//   GeminiClient 가 이 플래그를 보고 "설정 안내" 배너를 렌더한다.
export type KeyStoreActionResult<T> = AdminActionResult<T> & {
  setup_required?: boolean;
};

function friendlyKeyStoreMessage(code: string | undefined, raw: string): string {
  switch (code) {
    case "ERR_KEY_STORE_NOT_CONFIGURED":
    case "ERR_DEPENDENCY_UNAVAILABLE":
      // 2026-06-25 — 마스터 KEK 미설정. ADMIN 에서 에러를 터뜨리는 대신
      //   setup_required 플래그로 분리해 UI 에서 안내 배너를 표시한다.
      return "KEY_STORE_NOT_CONFIGURED";
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
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const trimmed = String(id || "").trim();
  if (!trimmed) return { ok: false, message: "id 누락" };
  const res = await disableGeminiKeysStore({ jwt, id: trimmed });
  if (!res.ok) {
    return { ok: false, code: res.code, message: friendlyKeyStoreMessage(res.code, res.message) };
  }
  return { ok: true, data: { item: res.data.item } };
}

// 2026-06-24 — AI Key 회전(rotate) action.
//   신규 평문 API KEY + reason(5자 이상) 을 받아 서버에 PUT 요청.
//   완료 시 audit_log (ai_key.rotated) 1건 기록.
//   KEY 실 값은 서버(Secrets Manager)에서만 처리 — ADMIN 은 rotate command 만 발행.
export async function rotateKeyStoreAction(
  id: string,
  newApiKey: string,
  reason: string,
): Promise<AdminActionResult<{ item: GeminiKeysStoreItem }>> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const keyTrimmed = String(newApiKey || "").trim();
  const reasonTrimmed = String(reason || "").trim();
  if (!keyTrimmed)
    return { ok: false, message: "새 API KEY 가 비어 있습니다" };
  if (!/^[A-Za-z][A-Za-z0-9._-]{19,}$/.test(keyTrimmed) || keyTrimmed.length > 256)
    return { ok: false, message: "API KEY 형식이 올바르지 않습니다 (예: AIza...)" };
  if (reasonTrimmed.length < 5)
    return { ok: false, message: "회전 사유는 5자 이상 입력하세요" };

  const res = await rotateGeminiKeysStore({ jwt, id, newApiKey: keyTrimmed, reason: reasonTrimmed });
  if (!res.ok) {
    return { ok: false, code: res.code, message: friendlyKeyStoreMessage(res.code, res.message) };
  }

  // audit log 기록 — best-effort (실패해도 rotate 결과는 반환)
  try {
    const payloadHash = createHash("sha256")
      .update(JSON.stringify({ id, action: "ai_key.rotated", reason: reasonTrimmed }))
      .digest("hex");
    await appendAuditLog({
      jwt,
      input: {
        action: "ai_key.rotated",
        targetResourceType: "ai_key",
        targetResourceId: id,
        reasonText: reasonTrimmed,
        payloadHash,
      },
    });
  } catch {
    // audit log 실패는 toast 경고로만 처리 (rotate 자체는 성공)
  }

  return { ok: true, data: { item: res.data.item } };
}

export async function keysStoreUsageSummaryAction(
  range: "24h" | "7d" | "30d" = "30d",
): Promise<AdminActionResult<GeminiKeysStoreUsageSummary>> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await geminiKeysStoreUsageSummary({ jwt, range });
  if (!res.ok) return { ok: false, code: res.code, message: res.message };
  return { ok: true, data: res.data };
}
