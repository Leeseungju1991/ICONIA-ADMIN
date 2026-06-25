"use server";

// Phase 9 #5 — Operator TOTP backup code server actions.

import { readSession } from "@/lib/authCookie";
import { generateBackupCodes, verifyBackupCode } from "@/lib/adminApi";

export type GenerateBackupCodesResult =
  | { ok: true; codes: string[]; count: number }
  | { ok: false; message: string; code?: string };

export async function generateBackupCodesAction(): Promise<GenerateBackupCodesResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await generateBackupCodes({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, codes: res.data.codes, count: res.data.count };
}

export type VerifyBackupCodeResult =
  | { ok: true; remaining: number }
  | { ok: false; message: string; code?: string };

export async function verifyBackupCodeAction(args: {
  code: string;
}): Promise<VerifyBackupCodeResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.code || args.code.trim().length < 4) {
    return { ok: false, message: "백업 코드를 입력하세요." };
  }
  const res = await verifyBackupCode({ jwt, code: args.code.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, remaining: res.data.remaining };
}
