"use server";

import { cookies } from "next/headers";
import { fetchUser360Snapshot, fetchUser360Timeline } from "../serverApi.user360";
import type { User360Snapshot, User360Event } from "../mockUser360";
import { mockUser360Snapshot, mockUser360Timeline } from "../mockUser360";
import { hideCommunityPost, takedownCommunityPost, unhideCommunityPost, hidePostsByAuthor } from "../serverApi.community";

const COOKIE = "iconia_admin_jwt";

function jwt(): string | null {
  return cookies().get(COOKIE)?.value ?? null;
}

// 서버 미도달(network/5xx) 시에만 mock 으로 graceful fallback. 인증/권한 오류
// (ERR_UNAUTHENTICATED / ERR_FORBIDDEN 등) 는 fallback 하지 않고 그대로 노출한다.
const FALLBACK_CODES = new Set(["ERR_NETWORK", "ERR_SERVER_UNAVAILABLE"]);

// Mock-16 — production NODE_ENV 게이트.
// production 빌드에서는 mock fallback 비활성화 — UI 가 명시적 USER360_UNAVAILABLE
// 에러로 안내. dev/preview 에서만 기존 mock fallback 사용.
const ALLOW_MOCK_FALLBACK = process.env.NODE_ENV !== "production";

export type User360ActionResult =
  | { ok: true; source: "server" | "mock"; snapshot: User360Snapshot }
  | { ok: false; code: string; message: string };

export async function fetchUser360Action(key: string): Promise<User360ActionResult> {
  const token = jwt();
  if (!token) return { ok: false, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  const r = await fetchUser360Snapshot(token, key);
  if (r.ok) return { ok: true, source: "server", snapshot: r.data };
  if (FALLBACK_CODES.has(r.code)) {
    if (!ALLOW_MOCK_FALLBACK) {
      // Mock-16 — production 에서는 mock fallback 비활성.
      return { ok: false, code: "USER360_UNAVAILABLE", message: "user360_unavailable" };
    }
    return { ok: true, source: "mock", snapshot: mockUser360Snapshot(key) };
  }
  return { ok: false, code: r.code, message: r.message };
}

export type User360TimelineResult =
  | { ok: true; source: "server" | "mock"; events: User360Event[]; next_cursor: string | null }
  | { ok: false; code: string; message: string };

export async function fetchUser360TimelineAction(key: string): Promise<User360TimelineResult> {
  const token = jwt();
  if (!token) return { ok: false, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  const r = await fetchUser360Timeline(token, key);
  if (r.ok) return { ok: true, source: "server", events: r.data.items, next_cursor: r.data.next_cursor };
  if (FALLBACK_CODES.has(r.code)) {
    if (!ALLOW_MOCK_FALLBACK) {
      // Mock-16 — production 에서는 mock fallback 비활성.
      return { ok: false, code: "USER360_UNAVAILABLE", message: "user360_unavailable" };
    }
    return { ok: true, source: "mock", events: mockUser360Timeline(key), next_cursor: null };
  }
  return { ok: false, code: r.code, message: r.message };
}

export async function hidePostsByUserAction(authorId: string, reason: string) {
  const token = jwt();
  if (!token) return { ok: false as const, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  if (reason.trim().length < 5) return { ok: false as const, code: "ERR_REASON_TOO_SHORT", message: "reason_too_short" };
  return hidePostsByAuthor(token, authorId, reason);
}
