"use server";

// V1.0 #13 — 펌웨어 빌드 카탈로그 server action.
// Server: GET /api/v1/admin/firmware

import { readSession } from "@/lib/authCookie";
import {
  listFirmware,
  type FirmwareVersionRow,
  type DeploymentRow,
} from "@/lib/adminApi";

export type ListFirmwareResult =
  | { ok: true; versions: FirmwareVersionRow[]; deployments: DeploymentRow[] }
  | { ok: false; message: string; code?: string };

export async function listFirmwareCatalogAction(): Promise<ListFirmwareResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listFirmware({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    versions: res.data.versions,
    deployments: res.data.deployments,
  };
}
