"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";
import {
  forceUnpairDevice,
  markDeviceLost,
  listDevices,
  fetchDeviceEvents,
  type DeviceRow,
  type DeviceEventRow,
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

export type ListDeviceEventsResult =
  | { ok: true; items: DeviceEventRow[]; next_cursor: string | null }
  | { ok: false; message: string; code?: string };

// 기기 센서/미디어 이벤트 (사진/터치/배터리) — Server GET /api/v1/admin/devices/:id/events.
export async function listDeviceEventsAction(args: {
  deviceId: string;
  cursor?: string | null;
  limit?: number;
}): Promise<ListDeviceEventsResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다." };
  if (!args.deviceId) return { ok: false, message: "device_id 누락" };
  const res = await fetchDeviceEvents({
    jwt,
    deviceId: args.deviceId,
    cursor: args.cursor ?? undefined,
    limit: args.limit ?? 30,
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

// Mock-15 — Firmware error 이벤트 (24h) Server 정본 활용.
// Server: GET /api/v1/admin/devices/events?type=firmware_error
// 실패 시 graceful 빈 배열 + source:"fallback" 라벨.
export type FirmwareErrorEvent = {
  id: string;
  device_id: string;
  firmware_version: string;
  error_code: string;
  message: string;
  count: number;
  first_seen: string;
  last_seen: string;
  severity?: "critical" | "error" | "warn";
};

export type FirmwareErrorsResult =
  | { ok: true; items: FirmwareErrorEvent[]; source: "server" | "fallback" }
  | { ok: false; message: string; code?: string };

export async function listFirmwareErrorEventsAction(): Promise<FirmwareErrorsResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다." };
  try {
    const res = await authedRequest<{ items: FirmwareErrorEvent[] }>({
      jwt,
      path: `/api/v1/admin/devices/events?type=firmware_error`,
      method: "GET",
    });
    if (res.ok) return { ok: true, items: res.data.items ?? [], source: "server" };
    return { ok: true, items: [], source: "fallback" };
  } catch {
    return { ok: true, items: [], source: "fallback" };
  }
}

// Mock-15 — OTA 펌웨어 배포 현황. Server: GET /api/v1/admin/firmware/deployments
export type FirmwareDeploymentRow = {
  id: string;
  version: string;
  channel: "stable" | "beta" | "canary";
  size_bytes: number;
  uploaded_at: string;
  notes: string;
  state: "draft" | "rolling_out" | "completed" | "rolled_back";
  target_count: number;
  applied_count: number;
  failed_count: number;
};

export type FirmwareDeploymentsResult =
  | { ok: true; items: FirmwareDeploymentRow[]; source: "server" | "fallback" }
  | { ok: false; message: string; code?: string };

export async function listFirmwareDeploymentsAction(): Promise<FirmwareDeploymentsResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다." };
  try {
    const res = await authedRequest<{ items: FirmwareDeploymentRow[] }>({
      jwt,
      path: `/api/v1/admin/firmware/deployments`,
      method: "GET",
    });
    if (res.ok) return { ok: true, items: res.data.items ?? [], source: "server" };
    return { ok: true, items: [], source: "fallback" };
  } catch {
    return { ok: true, items: [], source: "fallback" };
  }
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
