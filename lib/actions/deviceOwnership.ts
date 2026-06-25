"use server";

// V3.0 #16 — Device ownership history server action.
// Server: GET /api/v1/admin/devices/:id/ownership-history

import { readSession } from "@/lib/authCookie";
import {
  fetchDeviceOwnershipHistory,
  type OwnershipHop,
} from "@/lib/adminApi";

export type DeviceOwnershipResult =
  | {
      ok: true;
      device_id: string;
      device_uuid: string | null;
      history: OwnershipHop[];
    }
  | { ok: false; message: string; code?: string };

export async function fetchDeviceOwnershipHistoryAction(args: {
  deviceId: string;
}): Promise<DeviceOwnershipResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await fetchDeviceOwnershipHistory({ jwt, deviceId: args.deviceId });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    device_id: res.data.device_id,
    device_uuid: res.data.device_uuid,
    history: res.data.history,
  };
}
