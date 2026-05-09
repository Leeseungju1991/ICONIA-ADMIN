import { loadEnv } from "./env";
import type { ServerEnvelope, ServerResult } from "./types";

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

async function authedRequest<T>({
  jwt, path, method, body,
}: {
  jwt: string; path: string; method: "GET" | "POST"; body?: Record<string, unknown>;
}): Promise<ServerResult<T>> {
  const env = loadEnv();
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${jwt}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response: Response;
  try {
    response = await fetch(`${env.ICONIA_SERVER_URL}${path}`, {
      method, headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: "ERR_NETWORK", message: "network_error", status: 0 };
  }
  let envelope: ServerEnvelope<T>;
  try {
    envelope = (await response.json()) as ServerEnvelope<T>;
  } catch {
    return { ok: false, code: "ERR_INVALID_RESPONSE", message: "invalid_response", status: response.status };
  }
  if (response.status >= 500) {
    return { ok: false, code: "ERR_SERVER_UNAVAILABLE", message: "server_unavailable", status: response.status };
  }
  if (envelope?.ok === true) return { ok: true, data: envelope.data };
  if (envelope?.ok === false && envelope.error) {
    return {
      ok: false, code: envelope.error.code, message: envelope.error.message,
      status: response.status, details: envelope.error.details,
    };
  }
  return { ok: false, code: "ERR_INVALID_RESPONSE", message: "invalid_response", status: response.status };
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
