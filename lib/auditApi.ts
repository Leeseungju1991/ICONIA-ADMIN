import { authedRequest } from "./httpClient";
import type { ServerResult } from "./types";

// Audit log read 클라이언트. /api/v1/admin/audit-log.
// secops/sre/superadmin 전용 (서버 권한 차단 — admin web 은 path gating 별도).

export type AuditEntry = {
  id: string;
  sequence_no: number | null;
  action: string;
  user_id: string | null;
  operator_id: string | null;
  operator_role: string | null;
  target_resource_type: string | null;
  target_resource_id: string | null;
  action_outcome: string | null;
  ip: string;
  user_agent: string;
  metadata: unknown;
  created_at: string;
  request_id: string | null;
  prev_hash: string | null;
  current_hash: string | null;
};
export type AuditList = {
  items: AuditEntry[];
  next_cursor: string | null;
  since: string;
};

// 인라인 authedRequest 제거 — lib/httpClient.ts 의 공유 구현 사용 (P1 §5.2 #34).

// P1 §5 (2026-05-19) — 운영자 액션 감사 로그 client-side 기록 helper.
//
// Server 측 `/api/v1/operator/*` mutating 엔드포인트는 audit_logs 에 자동 기록되지만,
// admin UI 가 mock 핸들러를 가진 액션 (강제 로그아웃 confirm 전 단계, 페르소나 변경,
// MFA 초기화) 에서도 *시도*를 남기기 위해 별도 entry-point 를 둔다.
//
// 서버 contract 는 미정 (사용자 결정 필요사항 A) — 본 helper 는 404 / 5xx 를
// best-effort 로 흡수하고 UI 에 toast 만 띄운다. payload_hash 는 SHA-256 hex.
export type AuditAppendInput = {
  action: string;
  targetUserId?: string;
  targetResourceType?: string;
  targetResourceId?: string;
  payloadHash?: string;
  reasonText?: string;
};

export function appendAuditLog(args: {
  jwt: string;
  input: AuditAppendInput;
  requestId?: string;
}): Promise<ServerResult<{ id: string } | Record<string, unknown>>> {
  const body: Record<string, unknown> = {
    action: args.input.action,
    request_id: args.requestId ?? crypto.randomUUID(),
  };
  if (args.input.targetUserId) body.target_user_id = args.input.targetUserId;
  if (args.input.targetResourceType)
    body.target_resource_type = args.input.targetResourceType;
  if (args.input.targetResourceId)
    body.target_resource_id = args.input.targetResourceId;
  if (args.input.payloadHash) body.payload_hash = args.input.payloadHash;
  if (args.input.reasonText) body.reason_text = args.input.reasonText;
  return authedRequest<{ id: string } | Record<string, unknown>>({
    jwt: args.jwt,
    path: "/api/v1/admin/audit-log",
    method: "POST",
    body,
  });
}

export function listAuditLog(args: {
  jwt: string;
  action?: string;
  operatorId?: string;
  targetType?: string;
  since?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<ServerResult<AuditList>> {
  const params = new URLSearchParams();
  if (args.action) params.set("action", args.action);
  if (args.operatorId) params.set("operator_id", args.operatorId);
  if (args.targetType) params.set("target_resource_type", args.targetType);
  if (args.since) params.set("since", args.since);
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest<AuditList>({
    jwt: args.jwt,
    path: `/api/v1/admin/audit-log${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}
