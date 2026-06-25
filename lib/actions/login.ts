"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { writeSession } from "../authCookie";
import { operatorLoginStep1 } from "../serverApi";
import type { FormState } from "../types";

// 2026-06-01: real server-side operator login.
//   - Calls /api/v1/operator/login (operatorLoginStep1).
//   - If the operator has mfa_required=false, server returns access_token
//     directly in step1 — we write it to the session cookie and redirect.
//   - If mfa_required=true, this single-form UI cannot finish the flow
//     (no TOTP input) — returns ERR_OPERATOR_MFA_REQUIRED.
//   - ID field accepts either an email or a bare username (auto-suffixed
//     with the default operator domain).

const schema = z.object({
  username: z.string().min(1).max(254),
  password: z.string().min(1).max(256),
});

const DEFAULT_EMAIL_DOMAIN = "soomkorea.com";

type LoginIssuedRaw = {
  mfa_required: false;
  access_token: string;
  access_token_expires_in_sec: number;
  session_id: string;
  operator: { id: string; email: string; role?: string };
};

function isIssued(data: unknown): data is LoginIssuedRaw {
  return (
    typeof data === "object" &&
    data !== null &&
    (data as { mfa_required?: unknown }).mfa_required === false &&
    typeof (data as { access_token?: unknown }).access_token === "string"
  );
}

export async function loginAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = schema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", code: "ERR_VALIDATION_LOCAL" };
  }
  const rawId = parsed.data.username.trim().toLowerCase();
  const email = rawId.includes("@") ? rawId : `${rawId}@${DEFAULT_EMAIL_DOMAIN}`;

  const result = await operatorLoginStep1({ email, password: parsed.data.password });
  if (!result.ok) {
    return { status: "error", code: result.code, message: result.message };
  }

  if (isIssued(result.data)) {
    const ttlSec = result.data.access_token_expires_in_sec || 3600;
    const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();
    await writeSession({ jwt: result.data.access_token, expiresAt });
    redirect("/dashboard");
  }

  return {
    status: "error",
    code: "ERR_OPERATOR_MFA_REQUIRED",
    message: "MFA enabled — single-form login disabled for this account",
  };
}
