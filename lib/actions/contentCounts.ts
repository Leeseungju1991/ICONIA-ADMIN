"use server";

// 2026-05-27 — 콘텐츠 hub 카운트 (feed / commerce / info).
// Server (TBD): GET /api/v1/admin/feed · /api/v1/admin/commerce · /api/v1/admin/info
// (서버 컨벤션 /api/v1/* prefix — 2. SERVER/src/routes/* 모든 admin 라우트 일관.)
// 각각 `{ items: [], total: number }` 만 기대 — 그 외 필드는 별도 페이지에서.

import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";

const DEV = process.env.NODE_ENV !== "production";

const FIXTURE_COUNT: Record<"feed" | "commerce" | "info", number> = {
  feed: 1432,
  commerce: 87,
  info: 24,
};

export async function authedFetchCount(
  surface: "feed" | "commerce" | "info",
): Promise<
  | { ok: true; count: number; source: "server" | "fixture" }
  | { ok: false; message: string; source: null }
> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료", source: null };
  const res = await authedRequest<{ items?: unknown[]; total?: number }>({
    jwt,
    path: `/api/v1/admin/${surface}`,
    method: "GET",
  });
  if (res.ok) {
    const total =
      typeof res.data.total === "number"
        ? res.data.total
        : Array.isArray(res.data.items)
          ? res.data.items.length
          : 0;
    return { ok: true, count: total, source: "server" };
  }
  const unreachable =
    res.code === "ERR_NETWORK" || res.code === "ERR_SERVER_UNAVAILABLE";
  if (DEV && unreachable) {
    return { ok: true, count: FIXTURE_COUNT[surface], source: "fixture" };
  }
  return { ok: false, message: res.message, source: null };
}
