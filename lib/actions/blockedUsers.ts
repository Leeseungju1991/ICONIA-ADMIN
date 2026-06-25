"use server";

// 2026-06-16 — 차단 사용자 관리 actions.
// Server: GET  /api/v1/admin/users/:userId/blocked-users?query=&sort=created_at|display_name
//         POST /api/v1/admin/users/:userId/unblock  body={target_user_id}
// (cf. APP GET /api/v1/me/blocks 와 동일 계약 — 관리자는 임의 userId 의 차단 목록을 조회·해제.)

import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";
import type {
  AdminResult,
  BlockedUserSort,
  BlockedUsersResponse,
} from "@/types/admin-api";

function unreachable(code?: string): boolean {
  return code === "ERR_NETWORK" || code === "ERR_SERVER_UNAVAILABLE";
}

export async function listBlockedUsersAction(args: {
  userId: string;
  query?: string;
  sort?: BlockedUserSort;
}): Promise<AdminResult<BlockedUsersResponse>> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.userId.trim()) return { ok: false, message: "사용자 ID 가 필요합니다." };
  const params = new URLSearchParams();
  if (args.query) params.set("query", args.query);
  if (args.sort) params.set("sort", args.sort);
  const qs = params.toString();
  const res = await authedRequest<BlockedUsersResponse>({
    jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/blocked-users${
      qs ? `?${qs}` : ""
    }`,
    method: "GET",
  });
  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: res.message,
      unreachable: unreachable(res.code),
    };
  }
  return { ok: true, data: res.data };
}

export async function unblockUserAction(args: {
  userId: string;
  targetUserId: string;
}): Promise<AdminResult<{ ok: true }>> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.userId.trim()) return { ok: false, message: "사용자 ID 가 필요합니다." };
  if (!args.targetUserId.trim()) {
    return { ok: false, message: "차단 해제 대상 ID 가 필요합니다." };
  }
  const res = await authedRequest<{ ok: true }>({
    jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/unblock`,
    method: "POST",
    body: { target_user_id: args.targetUserId },
  });
  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: res.message,
      unreachable: unreachable(res.code),
    };
  }
  return { ok: true, data: res.data };
}
