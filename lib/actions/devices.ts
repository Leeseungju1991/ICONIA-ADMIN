"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import {
  forceUnpairDevice,
  markDeviceLost,
} from "@/lib/adminApi";

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
