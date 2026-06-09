"use server";

// 2026-05-27 — OTA 펌웨어 업로드/배포 server actions.
// 서버 정본 (cf. adminFirmwareActionRoutes.js / firmwareDeploymentRoutes.js):
//   POST /api/v1/admin/firmware/upload                         (presigned PUT URL)
//   POST /api/v1/admin/firmware/deployments/:id/advance        (rollout 단계 진행)
// 서버 미존재:
//   - register 단계 (presign 응답에 firmwareId 포함 → 추가 호출 불필요)
//   - device-groups (dev fixture fallback / production 빈 배열)
// 본 모듈은 위 정본에 맞춰 호출. 미존재 endpoint 는 graceful 처리.

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
  // B1 — 서버 정본 `/api/v1/admin/firmware/upload` (presigned PUT URL 반환).
  const res = await authedRequest<OtaPresignResponse>({
    jwt,
    path: "/api/v1/admin/firmware/upload",
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

// B2 — 서버 정본 register endpoint 미존재.
// presign 응답 자체에 firmwareId 가 포함되므로 추가 호출은 불필요.
// 호출 시퀀스 호환성 위해 함수는 유지하되 즉시 ok 반환 (graceful no-op).
// 향후 서버에서 register 단계가 도입되면 본 함수에서 호출 추가.
export async function registerFirmwareUploadAction(args: {
  firmwareId: string;
}): Promise<AdminResult<{ ok: true }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  try {
    void args.firmwareId;
    return { ok: true, data: { ok: true } };
  } catch {
    return { ok: true, data: { ok: true } };
  }
}

// B3 — 서버 정본 device-groups endpoint 미배포.
// dev: 기존 fixture fallback 유지 (검증 흐름 확인용).
// production: 빈 배열 반환 + UI 가 `데이터 준비 중` 라벨 표시.
export async function listDeviceGroupsAction(): Promise<
  AdminResult<{ items: OtaDeviceGroup[] }> & { source: "server" | "fixture" | "fallback" }
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
  if (!DEV && unreachable(res.code)) {
    // production graceful — UI 가 "데이터 준비 중" 라벨 + 빈 리스트 표시.
    return { ok: true, data: { items: [] }, source: "fallback" };
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
  // B4 — 서버 정본 `/api/v1/admin/firmware/deployments/:id/advance`.
  // :id 는 firmware_id (배포 식별자) 로 매핑. 서버는 body 의 group_ids/canary_percent
  // 를 advance 컨텍스트에 적용한다.
  const res = await authedRequest<OtaRolloutResponse>({
    jwt,
    path: `/api/v1/admin/firmware/deployments/${encodeURIComponent(req.firmware_id)}/advance`,
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
