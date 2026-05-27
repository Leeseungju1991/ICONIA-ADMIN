"use server";

// 사용자 권리 요청 큐 server actions — PIPA 제35/36/37조 (열람·정정·삭제·이관).
//
// Server `/api/v1/admin/users/rights` 가 도입되면 그대로 실 데이터로 swap.
// 미구현 시 PIPA pending_deletion (실 endpoint) + placeholder 정정/열람 요청 mock 으로
// 큐 화면을 채운다. 페이지는 placeholder=true 일 때 DEMO 배너로 명시.

import { readSession } from "@/lib/authCookie";
import {
  listRightsRequests,
  transitionRightsRequest,
  listPipaUsers,
  type RightsRequestKind,
  type RightsRequestRow,
  type RightsRequestStatus,
} from "@/lib/adminApi";

export type RightsActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

/**
 * 권리 요청 큐 조회. 우선 `/api/v1/admin/users/rights` 시도.
 * 실패 (미구현/네트워크) 시 PIPA pending_deletion 을 'delete' 요청으로 augment.
 */
export async function listRightsRequestsAction(args?: {
  kind?: RightsRequestKind;
  status?: RightsRequestStatus;
  limit?: number;
}): Promise<RightsActionResult<{ items: RightsRequestRow[]; placeholder: boolean; pipa_augmented: boolean }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };

  const limit = args?.limit ?? 50;
  const res = await listRightsRequests({ jwt, kind: args?.kind, status: args?.status, limit });
  if (res.ok) {
    return { ok: true, data: { items: res.data.items, placeholder: false, pipa_augmented: false } };
  }

  // graceful fallback — PIPA pending_deletion 만이라도 노출.
  if (res.code === "ERR_NETWORK" || res.code === "ERR_INVALID_RESPONSE" || res.status === 404) {
    const pipa = await listPipaUsers({ jwt, status: "pending_deletion" });
    const pipaItems: RightsRequestRow[] = pipa.ok
      ? pipa.data.items.slice(0, limit).map((u) => ({
          id: `pipa-${u.user_id}`,
          user_id: u.user_id,
          kind: "delete" as const,
          status: "in_review" as const,
          user_reason: "탈퇴 요청 (PIPA pending_deletion)",
          operator_note: null,
          received_at: u.pending_deletion_at ?? new Date().toISOString(),
          closed_at: null,
          operator_id_closed: null,
        }))
      : [];

    // placeholder 행 — 운영자가 큐 표면 자체를 빈 화면이 아닌 형태로 인지하도록.
    const now = new Date().toISOString();
    const placeholderItems: RightsRequestRow[] = [
      {
        id: "demo-access-1",
        user_id: "00000000-0000-0000-0000-000000000001",
        kind: "access",
        status: "received",
        user_reason: "내 데이터 사본 요청 (PIPA 제35조).",
        operator_note: null,
        received_at: now,
        closed_at: null,
        operator_id_closed: null,
      },
      {
        id: "demo-rectify-1",
        user_id: "00000000-0000-0000-0000-000000000002",
        kind: "rectify",
        status: "in_review",
        user_reason: "프로필 이름 정정 요청.",
        operator_note: null,
        received_at: now,
        closed_at: null,
        operator_id_closed: null,
      },
    ];

    // filter
    const all = [...pipaItems, ...placeholderItems];
    const filtered = all
      .filter((r) => (args?.kind ? r.kind === args.kind : true))
      .filter((r) => (args?.status ? r.status === args.status : true))
      .slice(0, limit);

    return {
      ok: true,
      data: { items: filtered, placeholder: true, pipa_augmented: pipa.ok },
    };
  }
  return { ok: false, message: res.message, code: res.code };
}

/** 권리 요청 상태 전이. */
export async function transitionRightsAction(args: {
  id: string;
  next_status: RightsRequestStatus;
  reason: string;
}): Promise<RightsActionResult<RightsRequestRow>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.reason || args.reason.trim().length < 5) {
    return { ok: false, message: "사유는 5자 이상 입력하세요." };
  }
  const res = await transitionRightsRequest({
    jwt,
    id: args.id,
    next_status: args.next_status,
    reason: args.reason.trim(),
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
