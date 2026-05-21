"use server";

// V1.0 #1 (Phase 10-C) — Server /api/v1/admin/users 실 사용자 목록 server action.
// 기존 users/page.tsx 가 mockUsers 에서 직접 import 하던 가짜 구현 카탈로그 #1 정정.
// adminApi.searchUsers 는 q=email 검색 단일 사용자 retrieval 형 — list 표시용으로 빈 검색어 호출.

import { readSession } from "@/lib/authCookie";
import { searchUsers, type UserRow } from "@/lib/adminApi";

export type ListUsersResult =
  | { ok: true; users: UserRow[]; total: number }
  | { ok: false; message: string; code?: string };

export async function listUsersAction(args?: {
  email?: string;
  limit?: number;
}): Promise<ListUsersResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  // 빈 검색어 (전체 list) 도 Server 가 처리하도록 — 운영자가 dashboard 진입 시 첫 로딩.
  const res = await searchUsers({ jwt, email: args?.email ?? "", limit: args?.limit ?? 50 });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, users: res.data.users, total: res.data.total };
}
