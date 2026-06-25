"use server";

// Phase 12 #10 — Operator TOTP enroll/verify server actions.
// Server: POST /api/v1/operator/totp/{enroll,verify}

import { readSession } from "@/lib/authCookie";
import { enrollOperatorTotp, verifyOperatorTotpEnroll } from "@/lib/adminApi";

export type EnrollTotpResult =
  | { ok: true; otpauth_uri: string; totp_secret_base32: string }
  | { ok: false; message: string; code?: string };

export async function enrollTotpAction(): Promise<EnrollTotpResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await enrollOperatorTotp({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    otpauth_uri: res.data.otpauth_uri,
    totp_secret_base32: res.data.totp_secret_base32,
  };
}

export type VerifyTotpResult =
  | { ok: true; mfa_required: boolean }
  | { ok: false; message: string; code?: string };

export async function verifyTotpEnrollAction(args: {
  code: string;
}): Promise<VerifyTotpResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.code || args.code.trim().length < 6) {
    return { ok: false, message: "6자리 인증 코드를 입력하세요." };
  }
  const res = await verifyOperatorTotpEnroll({ jwt, code: args.code.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, mfa_required: res.data.mfa_required };
}
