"use server";

// V3.0 #27 — Device boot invariants server action.
// Server: GET /api/v1/admin/devices/:id/boot-invariants  (Phase4-A)

import { readSession } from "@/lib/authCookie";
import {
  getDeviceBootInvariants,
  type DeviceBootInvariants,
} from "@/lib/adminApi";

export type BootInvariantsResult =
  | { ok: true; data: DeviceBootInvariants }
  | { ok: false; message: string; code?: string };

export async function getDeviceBootInvariantsAction(args: {
  deviceId: string;
}): Promise<BootInvariantsResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await getDeviceBootInvariants({ jwt, deviceId: args.deviceId });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
