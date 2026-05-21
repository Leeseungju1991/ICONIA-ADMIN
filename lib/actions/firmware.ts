"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import {
  pauseDeployment,
  resumeDeployment,
  listFirmwareFailures,
  type FirmwareFailureList,
} from "@/lib/adminApi";

export type ListFirmwareFailuresResult =
  | { ok: true; data: FirmwareFailureList }
  | { ok: false; message: string; code?: string };

export async function listFirmwareFailuresAction(args?: {
  version?: string;
  since?: string;
}): Promise<ListFirmwareFailuresResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다." };
  const res = await listFirmwareFailures({
    jwt,
    version: args?.version,
    since: args?.since,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export async function pauseDeploymentAction(formData: FormData) {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const deploymentId = String(formData.get("deployment_id") || "");
  const reason = String(formData.get("reason") || "");
  if (!deploymentId) return { ok: false, message: "deployment_id 누락" };
  const res = await pauseDeployment({ jwt, deploymentId, reason });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/firmware");
  return { ok: true };
}

export async function resumeDeploymentAction(formData: FormData) {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const deploymentId = String(formData.get("deployment_id") || "");
  const reason = String(formData.get("reason") || "");
  if (!deploymentId) return { ok: false, message: "deployment_id 누락" };
  const res = await resumeDeployment({
    jwt,
    deploymentId,
    reason: reason || undefined,
  });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/firmware");
  return { ok: true };
}
