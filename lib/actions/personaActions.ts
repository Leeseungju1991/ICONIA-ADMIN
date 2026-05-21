"use server";

// Phase 15-A — Persona action server actions (SUPERADMIN_ONLY).

import { readSession } from "@/lib/authCookie";
import { stagePersona, promotePersona, rollbackPersona } from "@/lib/adminApi";

export type PersonaActionResult =
  | { ok: true }
  | { ok: false; message: string; code?: string };

function validateReason(reason: string): string | null {
  if (!reason || reason.trim().length < 5) return "사유는 5자 이상 입력해야 합니다.";
  return null;
}

export async function stagePersonaAction(args: {
  soulCatalogId: string;
  reason: string;
}): Promise<PersonaActionResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const v = validateReason(args.reason);
  if (v) return { ok: false, message: v };
  const res = await stagePersona({ jwt, soulCatalogId: args.soulCatalogId, reason: args.reason.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true };
}

export async function promotePersonaAction(args: {
  soulCatalogId: string;
  reason: string;
}): Promise<PersonaActionResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const v = validateReason(args.reason);
  if (v) return { ok: false, message: v };
  const res = await promotePersona({ jwt, soulCatalogId: args.soulCatalogId, reason: args.reason.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true };
}

export async function rollbackPersonaAction(args: {
  soulCatalogId: string;
  reason: string;
  target_version?: string;
}): Promise<PersonaActionResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const v = validateReason(args.reason);
  if (v) return { ok: false, message: v };
  const res = await rollbackPersona({
    jwt,
    soulCatalogId: args.soulCatalogId,
    reason: args.reason.trim(),
    target_version: args.target_version,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true };
}
