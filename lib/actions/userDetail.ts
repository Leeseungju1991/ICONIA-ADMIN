"use server";

// 2026-06-01 — P0 fix: 사용자 상세 drawer 가 row data 만 표시하고 server fresh detail
// 을 가져오지 않아 active_session_count 등이 누락되던 문제 정정.
// Server `GET /api/v1/admin/users/:id` 호출. adminGate ALL_ROLES.

import { readSession } from "@/lib/authCookie";
import { getUserDetail, type UserDetail } from "@/lib/adminApi";

export type GetUserDetailResult =
  | { ok: true; data: UserDetail }
  | { ok: false; message: string; code?: string };

export async function getUserDetailAction(input: {
  userId: string;
}): Promise<GetUserDetailResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료", code: "ERR_UNAUTHORIZED" };
  const res = await getUserDetail({ jwt, userId: input.userId });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
