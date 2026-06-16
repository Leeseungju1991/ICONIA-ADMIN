"use server";

// 2026-06-16 — 사용자별 Feature Flag 토글 actions (Wave 4 — 그로스/공유).
// Server: GET   /api/v1/admin/users/:userId/feature-flags -> { flags: [{flag_key, enabled}] }
//         PATCH /api/v1/admin/users/:userId/feature-flags  body={flag_key, enabled}
//                                                          -> {flag_key, enabled}
// 특정 사용자의 빌드타임 flag override 를 조회하고 개별 flag 를 토글한다.
// (cf. APP GET /api/v1/me/feature-flags -> {flags:{[key]:boolean}} — 빌드타임 flags 와 머지.)

import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";
import type {
  AdminResult,
  FeatureFlagKey,
  UserFeatureFlagRow,
  UserFeatureFlagsResponse,
} from "@/types/admin-api";

function unreachable(code?: string): boolean {
  return code === "ERR_NETWORK" || code === "ERR_SERVER_UNAVAILABLE";
}

export async function listUserFeatureFlagsAction(args: {
  userId: string;
}): Promise<AdminResult<UserFeatureFlagsResponse>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.userId.trim()) return { ok: false, message: "사용자 ID 가 필요합니다." };
  const res = await authedRequest<UserFeatureFlagsResponse>({
    jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/feature-flags`,
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

export async function setUserFeatureFlagAction(args: {
  userId: string;
  flagKey: FeatureFlagKey;
  enabled: boolean;
}): Promise<AdminResult<UserFeatureFlagRow>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.userId.trim()) return { ok: false, message: "사용자 ID 가 필요합니다." };
  if (!args.flagKey.trim()) return { ok: false, message: "flag_key 가 필요합니다." };
  const res = await authedRequest<UserFeatureFlagRow>({
    jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/feature-flags`,
    method: "PATCH",
    body: { flag_key: args.flagKey, enabled: args.enabled },
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
