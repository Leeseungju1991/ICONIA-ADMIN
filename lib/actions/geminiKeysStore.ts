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
  if (!/^AIza[A-Za-z0-9_\-]{20,}$/.test(trimmed) || trimmed.length > 256) {
    return { ok: false, message: "API KEY 형식이 올바르지 않습니다 (AIza... 로 시작)" };
  }
  const res = await addGeminiKeysStore({ jwt, apiKey: trimmed });
  if (!res.ok) return { ok: false, code: res.code, message: res.message };
  return { ok: true, data: { item: res.data.item, reactivated: res.data.reactivated } };
}

export async function disableKeyStoreAction(
  id: string,
): Promise<AdminActionResult<{ item: GeminiKeysStoreItem }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const trimmed = String(id || "").trim();
  if (!trimmed) return { ok: false, message: "id 누락" };
  const res = await disableGeminiKeysStore({ jwt, id: trimmed });
  if (!res.ok) return { ok: false, code: res.code, message: res.message };
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
