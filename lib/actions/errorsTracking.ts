"use server";

// 2026-05-27 — 오류 추적 (FW / Server / AI / APP) server action.
// 2026-06-01 정합: Server 에는 통합 `/admin/errors?domain=` 가 없고 도메인별 라우트만 존재.
//   GET /api/v1/admin/errors/{server,app,device} (adminErrorEventsRoutes.js).
//   → admin ErrorDomain 을 server source 토큰으로 매핑해 직접 호출한다 (firmware→device).
//   'ai' 는 전용 ledger 라우트가 없으므로 graceful 빈 결과로 처리(향후 /errors/ai 도입 시 매핑 추가).

import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";
import type {
  AdminResult,
  ErrorDomain,
  ErrorRow,
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
  // admin ErrorDomain → server 라우트 source 토큰. firmware 는 server 의 device ledger.
  const SOURCE_BY_DOMAIN: Record<ErrorDomain, string> = {
    server: "server",
    app: "app",
    firmware: "device",
    ai: "", // 전용 ledger 없음 → 빈 결과.
  };
  const token = SOURCE_BY_DOMAIN[args.domain];
  if (!token) {
    // ai 등 server ledger 가 없는 도메인 — graceful 빈 목록.
    return { ok: true, data: { items: [], next_cursor: null }, source: "server" };
  }
  const params = new URLSearchParams();
  if (args.since) params.set("since", args.since);
  const qs = params.toString();
  const res = await authedRequest<ErrorsResponse>({
    jwt,
    path: `/api/v1/admin/errors/${token}${qs ? `?${qs}` : ""}`,
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

// 2026-06-11 — 사용자 요청: 오류 추적 행마다 "처리 완료" 버튼.
//   Server: POST /api/v1/admin/errors/:id/resolve (SRE_OR_ABOVE)
//   성공 시 admin UI 가 목록에서 즉시 제거 → 카운트 자동 감소.
export async function resolveErrorAction(args: {
  id: string;
}): Promise<AdminResult<{ event: ErrorRow }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const id = String(args.id || "").trim();
  if (!id) return { ok: false, message: "id 누락" };
  const res = await authedRequest<{ event: ErrorRow }>({
    jwt,
    path: `/api/v1/admin/errors/${encodeURIComponent(id)}/resolve`,
    method: "POST",
  });
  if (res.ok) return { ok: true, data: res.data };
  return { ok: false, code: res.code, message: res.message };
}
