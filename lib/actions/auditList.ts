"use server";

// V1.0 — 감사 로그 뷰어 server action (read-only).
//
// Server: GET /api/v1/admin/audit-log?action=&operator_id=&since=&cursor=&limit=
// secops/sre/superadmin 전용. payload_hash 는 PII 없이 sha256 hex.

import { readSession } from "@/lib/authCookie";
import { listAuditLog, type AuditEntry } from "@/lib/auditApi";

export type AuditListInput = {
  action?: string;
  operatorId?: string;
  targetType?: string;
  since?: string;
  cursor?: string | null;
  limit?: number;
};

export type AuditListResult =
  | {
      ok: true;
      items: AuditEntry[];
      next_cursor: string | null;
      since: string;
    }
  | { ok: false; message: string; code?: string };

export async function listAuditLogAction(
  input: AuditListInput,
): Promise<AuditListResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listAuditLog({ jwt, ...input });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    items: res.data.items,
    next_cursor: res.data.next_cursor,
    since: res.data.since,
  };
}
