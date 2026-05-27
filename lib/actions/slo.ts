"use server";

// V1.0 — SLO 대시보드 server action.
//
// Server: GET /api/v1/admin/metrics/slo  (SRE_OR_ABOVE).
// 미배포 endpoint 라도 page 는 정상 렌더 + "—" 표시 — adminApi 가 graceful 처리.

import { readSession } from "@/lib/authCookie";
import { getSloSnapshot, type SloSnapshot } from "@/lib/adminApi";

export type SloSnapshotResult =
  | { ok: true; data: SloSnapshot }
  | { ok: false; message: string; code?: string };

export async function getSloSnapshotAction(): Promise<SloSnapshotResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await getSloSnapshot({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
