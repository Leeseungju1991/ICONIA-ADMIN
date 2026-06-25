"use server";

// V3.0 #18 — PIPA admin server actions.
// Server: GET  /api/v1/admin/users/pipa?status=
//          POST /api/v1/admin/users/:id/pipa/export
//          POST /api/v1/admin/users/:id/pipa/finalize
//
// 모두 SUPERADMIN_ONLY (사용자 PII 권리 행사 — operator 가 대행).

import { readSession } from "@/lib/authCookie";
import {
  listPipaUsers,
  triggerPipaExport,
  finalizePipaDeletion,
  type PipaUserRow,
} from "@/lib/adminApi";

export type PipaActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

export async function listPipaUsersAction(args: {
  status: "pending_deletion" | "recent_export";
}): Promise<PipaActionResult<{ items: PipaUserRow[] }>> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listPipaUsers({ jwt, status: args.status });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export async function triggerPipaExportAction(args: {
  userId: string;
  reason: string;
}): Promise<PipaActionResult<{ id: string; status: string }>> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.reason || args.reason.trim().length < 5) {
    return { ok: false, message: "사유는 5자 이상." };
  }
  const res = await triggerPipaExport({ jwt, userId: args.userId, reason: args.reason.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export async function finalizePipaDeletionAction(args: {
  userId: string;
  reason: string;
}): Promise<PipaActionResult<{ ok: boolean; deleted_at?: string }>> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.reason || args.reason.trim().length < 5) {
    return { ok: false, message: "사유는 5자 이상." };
  }
  const res = await finalizePipaDeletion({
    jwt,
    userId: args.userId,
    reason: args.reason.trim(),
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
