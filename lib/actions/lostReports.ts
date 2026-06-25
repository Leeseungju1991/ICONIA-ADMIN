"use server";

// 2026-06-10 — 분실/도난 신고 (Lost Report) server actions.
// Server: GET /api/v1/admin/lost-reports · PATCH /api/v1/admin/lost-reports/:id

import { readSession } from "@/lib/authCookie";
import {
  listLostReports,
  updateLostReportStatus,
  type LostReportRow,
  type LostReportStatus,
} from "@/lib/adminApi";

export type LostReportActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

export async function listLostReportsAction(args?: {
  status?: LostReportStatus;
  limit?: number;
}): Promise<LostReportActionResult<{ items: LostReportRow[]; next_cursor: string | null }>> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listLostReports({ jwt, status: args?.status, limit: args?.limit });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export async function updateLostReportStatusAction(formData: FormData): Promise<
  LostReportActionResult<{ report: LostReportRow }>
> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const id = String(formData.get("id") || "").trim();
  const status = String(formData.get("status") || "").trim() as LostReportStatus;
  if (!id || !["pending", "in_progress", "resolved", "rejected"].includes(status)) {
    return { ok: false, message: "id 와 상태(pending/in_progress/resolved/rejected) 가 필요합니다." };
  }
  const res = await updateLostReportStatus({ jwt, id, status });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
