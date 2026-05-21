"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import {
  forceUnpairDevice,
  markDeviceLost,
  listDevices,
  type DeviceRow,
} from "@/lib/adminApi";

export type ListDevicesResult =
  | { ok: true; items: DeviceRow[]; next_cursor: string | null }
  | { ok: false; message: string; code?: string };

export async function listDevicesAction(args?: {
  query?: string;
  status?: string;
  limit?: number;
}): Promise<ListDevicesResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다." };
  const res = await listDevices({
    jwt,
    query: args?.query,
    status: args?.status,
    limit: args?.limit ?? 50,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, items: res.data.items, next_cursor: res.data.next_cursor };
}

export async function forceUnpairAction(formData: FormData) {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다" };
  const deviceId = String(formData.get("device_id") || "");
  const reason = String(formData.get("reason") || "");
  if (!deviceId || !reason) {
    return { ok: false, message: "device_id / reason 누락" };
  }
  const res = await forceUnpairDevice({ jwt, deviceId, reason });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath(`/dashboard/devices/${deviceId}`);
  revalidatePath("/dashboard/devices");
  return { ok: true };
}

export async function markLostAction(formData: FormData) {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다" };
  const deviceId = String(formData.get("device_id") || "");
  const note = String(formData.get("note") || "");
  if (!deviceId) return { ok: false, message: "device_id 누락" };
  const res = await markDeviceLost({ jwt, deviceId, note });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath(`/dashboard/devices/${deviceId}`);
  revalidatePath("/dashboard/devices");
  return { ok: true };
}
