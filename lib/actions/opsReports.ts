"use server";

// 양산직전 #21 — OpsReport server actions.
// Server: GET /api/v1/admin/reports?kind=&since=&limit=
//          POST /api/v1/admin/reports/run

import { readSession } from "@/lib/authCookie";
import {
  listOpsReports,
  runOpsReport,
  type OpsReportKind,
  type OpsReportRow,
} from "@/lib/adminApi";

export type ListOpsReportsResult =
  | { ok: true; items: OpsReportRow[] }
  | { ok: false; message: string; code?: string };

export async function listOpsReportsAction(args?: {
  kind?: OpsReportKind;
  since?: string;
  limit?: number;
}): Promise<ListOpsReportsResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listOpsReports({ jwt, ...args });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, items: res.data.items };
}

export type RunOpsReportResult =
  | { ok: true; id?: string; duplicate?: boolean }
  | { ok: false; message: string; code?: string };

export async function runOpsReportAction(formData: FormData): Promise<RunOpsReportResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const kind = String(formData.get("kind") || "daily") as OpsReportKind;
  if (!["daily", "weekly", "quality"].includes(kind)) {
    return { ok: false, message: "kind 는 daily | weekly | quality" };
  }
  const res = await runOpsReport({ jwt, kind });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, id: res.data.id, duplicate: res.data.duplicate };
}
