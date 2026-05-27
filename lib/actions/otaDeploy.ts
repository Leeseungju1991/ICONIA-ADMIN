"use server";

// 2026-05-27 — OTA 펌웨어 업로드/배포 server actions.
// Server (TBD): POST /api/v1/admin/ota/firmwares    → presigned PUT URL 반환
//                POST /api/v1/admin/ota/firmwares/:id/register
//                GET  /api/v1/admin/ota/device-groups
//                POST /api/v1/admin/ota/rollouts
// (서버 컨벤션 /api/v1/* — cf. adminFirmwareActionRoutes.js / firmwareDeploymentRoutes.js.
//  본 4개 endpoint 자체는 미구현; 404 시 server action 이 graceful 처리.)

import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";
import type {
  AdminResult,
  OtaDeviceGroup,
  OtaPresignRequest,
  OtaPresignResponse,
  OtaRolloutRequest,
  OtaRolloutResponse,
} from "@/types/admin-api";

const DEV = process.env.NODE_ENV !== "production";

function unreachable(code?: string): boolean {
  return code === "ERR_NETWORK" || code === "ERR_SERVER_UNAVAILABLE";
}

export async function presignFirmwareUploadAction(
  req: OtaPresignRequest,
): Promise<AdminResult<OtaPresignResponse>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!req.version || req.version.trim().length < 3) {
    return { ok: false, message: "version 은 3자 이상." };
  }
  if (!req.sha256 || req.sha256.length !== 64) {
    return { ok: false, message: "sha256 은 64자 hex." };
  }
  if (!Number.isFinite(req.size_bytes) || req.size_bytes <= 0) {
    return { ok: false, message: "size_bytes 가 유효해야 함." };
  }
  const res = await authedRequest<OtaPresignResponse>({
    jwt,
    path: "/api/v1/admin/ota/firmwares",
    method: "POST",
    body: { ...req },
  });
  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: res.message,
      unreachable: unreachable(res.code),
    };
  }
  return { ok: true, data: res.data };
}

export async function registerFirmwareUploadAction(args: {
  firmwareId: string;
}): Promise<AdminResult<{ ok: true }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await authedRequest<{ ok: true }>({
    jwt,
    path: `/api/v1/admin/ota/firmwares/${encodeURIComponent(args.firmwareId)}/register`,
    method: "POST",
    body: {},
  });
  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: res.message,
      unreachable: unreachable(res.code),
    };
  }
  return { ok: true, data: res.data };
}

export async function listDeviceGroupsAction(): Promise<
  AdminResult<{ items: OtaDeviceGroup[] }> & { source: "server" | "fixture" }
> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료", source: "server" };
  const res = await authedRequest<{ items: OtaDeviceGroup[] }>({
    jwt,
    path: "/api/v1/admin/ota/device-groups",
    method: "GET",
  });
  if (res.ok) return { ok: true, data: res.data, source: "server" };
  if (DEV && unreachable(res.code)) {
    return {
      ok: true,
      data: {
        items: [
          { id: "grp_all", label: "전체 (Fleet)", device_count: 1284 },
          { id: "grp_canary", label: "Canary 5%", device_count: 64 },
          { id: "grp_beta", label: "Beta 채널", device_count: 320 },
          { id: "grp_kr", label: "지역: 한국", device_count: 982 },
        ],
      },
      source: "fixture",
    };
  }
  return {
    ok: false,
    code: res.code,
    message: res.message,
    unreachable: unreachable(res.code),
    source: "server",
  };
}

export async function createOtaRolloutAction(
  req: OtaRolloutRequest,
): Promise<AdminResult<OtaRolloutResponse>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!req.firmware_id) return { ok: false, message: "firmware_id 필요." };
  if (!Array.isArray(req.group_ids) || req.group_ids.length === 0) {
    return { ok: false, message: "디바이스 그룹을 최소 1개 선택하세요." };
  }
  const res = await authedRequest<OtaRolloutResponse>({
    jwt,
    path: "/api/v1/admin/ota/rollouts",
    method: "POST",
    body: { ...req },
  });
  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: res.message,
      unreachable: unreachable(res.code),
    };
  }
  return { ok: true, data: res.data };
}
