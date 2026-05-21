"use server";

// 양산직전 #15 — Fleet 디바이스 분포 server action.
// Server: GET /api/v1/admin/devices/distribution?by=version|region|cohort|fw_state  (Phase5-A)

import { readSession } from "@/lib/authCookie";
import {
  listDeviceDistribution,
  type DistributionBy,
  type DistributionItem,
} from "@/lib/adminApi";

export type DistributionResult =
  | { ok: true; by: DistributionBy; items: DistributionItem[] }
  | { ok: false; message: string; code?: string };

export async function fetchDistributionAction(args: {
  by: DistributionBy;
}): Promise<DistributionResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listDeviceDistribution({ jwt, by: args.by });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, by: res.data.by, items: res.data.items };
}
