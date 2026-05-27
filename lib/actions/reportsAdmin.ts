"use server";

// 2026-05-27 — 신고 통합 모더레이션 actions.
// Server: GET  /api/v1/admin/reports?status=open|resolved&kind=…
//         POST /api/v1/admin/reports/:report_id/resolve  body={action,reason}
// (cf. 2. SERVER/src/routes/adminReportsRoutes.js:87,171 — kind/status 필터 + resolve.)

import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";
import type {
  AdminResult,
  ReportAction,
  ReportRow,
  ReportStatus,
  ReportTargetKind,
  ReportsResponse,
} from "@/types/admin-api";
import { fixtureReports } from "@/fixtures/moderation";

const DEV = process.env.NODE_ENV !== "production";

function unreachable(code?: string): boolean {
  return code === "ERR_NETWORK" || code === "ERR_SERVER_UNAVAILABLE";
}

export async function listReportsAction(args: {
  status?: ReportStatus;
  kind?: ReportTargetKind;
  cursor?: string;
}): Promise<AdminResult<ReportsResponse> & { source: "server" | "fixture" }> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료", source: "server" };
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  if (args.kind) params.set("kind", args.kind);
  if (args.cursor) params.set("cursor", args.cursor);
  const qs = params.toString();
  const res = await authedRequest<ReportsResponse>({
    jwt,
    path: `/api/v1/admin/reports${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
  if (res.ok) return { ok: true, data: res.data, source: "server" };
  if (DEV && unreachable(res.code)) {
    // Filter fixtures by params for realistic preview.
    let items: ReportRow[] = fixtureReports;
    if (args.status) items = items.filter((r) => r.status === args.status);
    if (args.kind) items = items.filter((r) => r.target_kind === args.kind);
    return {
      ok: true,
      data: {
        items,
        next_cursor: null,
        total_open: fixtureReports.filter((r) => r.status === "open").length,
      },
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

export async function resolveReportAction(args: {
  reportId: string;
  action: ReportAction;
  reason: string;
}): Promise<AdminResult<{ ok: true }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.reason || args.reason.trim().length < 5) {
    return { ok: false, message: "사유는 5자 이상." };
  }
  const res = await authedRequest<{ ok: true }>({
    jwt,
    path: `/api/v1/admin/reports/${encodeURIComponent(args.reportId)}/resolve`,
    method: "POST",
    body: { action: args.action, reason: args.reason.trim() },
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
