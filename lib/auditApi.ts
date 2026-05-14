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
