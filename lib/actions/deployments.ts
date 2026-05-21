"use server";

// V2.0 #24 — Deployment ledger server action.
// Server: GET /api/v1/admin/deployments?cursor=&limit=&since=  (Phase4-A)

import { readSession } from "@/lib/authCookie";
import { listDeployments, type DeploymentLedgerRow } from "@/lib/adminApi";

export type ListDeploymentsResult =
  | { ok: true; items: DeploymentLedgerRow[]; next_cursor: string | null }
  | { ok: false; message: string; code?: string };

export async function listDeploymentsAction(args?: {
  cursor?: string | null;
  limit?: number;
  since?: string;
}): Promise<ListDeploymentsResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listDeployments({
    jwt,
    cursor: args?.cursor,
    limit: args?.limit ?? 20,
    since: args?.since,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, items: res.data.items, next_cursor: res.data.next_cursor };
}
