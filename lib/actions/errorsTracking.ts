"use server";

// 2026-05-27 — 오류 추적 (FW / Server / AI / APP) server action.
// Server: GET /api/v1/admin/errors?domain=…&since=ISO
// (cf. 2. SERVER/src/routes/adminErrorEventsRoutes.js:110+ — /api/v1/admin/errors/{server,app,device}.
//  본 통합 endpoint 는 TBD; 미구현 시 ERR_NETWORK/ERR_SERVER_UNAVAILABLE 로 fixture fallback.)

import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";
import type {
  AdminResult,
  ErrorDomain,
  ErrorsResponse,
} from "@/types/admin-api";
import { fixtureErrorsByDomain } from "@/fixtures/errors";

const DEV = process.env.NODE_ENV !== "production";

function unreachable(code?: string): boolean {
  return code === "ERR_NETWORK" || code === "ERR_SERVER_UNAVAILABLE";
}

export async function listErrorsAction(args: {
  domain: ErrorDomain;
  since?: string; // ISO8601
}): Promise<AdminResult<ErrorsResponse> & { source: "server" | "fixture" }> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료", source: "server" };
  const params = new URLSearchParams({ domain: args.domain });
  if (args.since) params.set("since", args.since);
  const res = await authedRequest<ErrorsResponse>({
    jwt,
    path: `/api/v1/admin/errors?${params.toString()}`,
    method: "GET",
  });
  if (res.ok) return { ok: true, data: res.data, source: "server" };
  if (DEV && unreachable(res.code)) {
    return {
      ok: true,
      data: { items: fixtureErrorsByDomain[args.domain] ?? [], next_cursor: null },
      source: "fixture",
    };
  }
  return {
    ok: false,
    code: res.code,
    message: res.message,
    unreachable: unreachable(res.code),
    source: "server",
  };
}
