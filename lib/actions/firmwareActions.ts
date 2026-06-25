"use server";

// Phase 15-A — Firmware action server actions (SRE_OR_ABOVE).

import { readSession } from "@/lib/authCookie";
import {
  uploadFirmware,
  advanceDeployment,
  abortDeployment,
} from "@/lib/adminApi";

export type UploadResult =
  | { ok: true; upload_url: string; s3_key: string }
  | { ok: false; message: string; code?: string };

export async function uploadFirmwareAction(args: {
  version: string;
  channel: string;
  sha256: string;
  size_bytes: number;
  notes?: string;
}): Promise<UploadResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.version || !args.channel || !args.sha256 || !args.size_bytes) {
    return { ok: false, message: "version/channel/sha256/size_bytes 모두 필수." };
  }
  const res = await uploadFirmware({ jwt, ...args });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, upload_url: res.data.upload_url, s3_key: res.data.s3_key };
}

export type DeploymentActionResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

export async function advanceDeploymentAction(args: {
  deploymentId: string;
  reason?: string;
}): Promise<DeploymentActionResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await advanceDeployment({ jwt, deploymentId: args.deploymentId, reason: args.reason });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true };
}

export async function abortDeploymentAction(args: {
  deploymentId: string;
  reason: string;
}): Promise<DeploymentActionResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.reason || args.reason.trim().length < 5) {
    return { ok: false, message: "abort 사유는 5자 이상 필수." };
  }
  const res = await abortDeployment({ jwt, deploymentId: args.deploymentId, reason: args.reason.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true };
}
