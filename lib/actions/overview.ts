"use server";

// V2.0 #8 — Admin overview server action.
// Server: GET /api/v1/admin/overview (Phase2-A).

import { readSession } from "@/lib/authCookie";
import { fetchAdminOverview, type AdminOverview } from "@/lib/adminApi";

export type AdminOverviewResult =
  | { ok: true; data: AdminOverview }
  | { ok: false; message: string; code?: string };

export async function fetchAdminOverviewAction(): Promise<AdminOverviewResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await fetchAdminOverview({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
