"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { writeSession } from "../authCookie";
import { operatorLoginStep1 } from "../serverApi";
import type { FormState } from "../types";
import { isDemoMode, mintDemoJwt, DEMO_CREDENTIALS } from "../demoMode";

// 2026-06-01: real server-side operator login.
//   - Calls /api/v1/operator/login (operatorLoginStep1).
//   - If the operator has mfa_required=false, server returns access_token
//     directly in step1 — we write it to the session cookie and redirect.
//   - If mfa_required=true, this single-form UI cannot finish the flow
//     (no TOTP input) — returns ERR_OPERATOR_MFA_REQUIRED.
//   - ID field accepts either an email or a bare username (auto-suffixed
//     with the default operator domain).
//
// 2026-08 (AWS→Vercel 마이그레이션): ADMIN_DEMO_MODE=true 이고 데모 계정
// (test/test, admin/admin)으로 로그인하면 실제 서버 호출 없이 즉시 세션을
// 발급한다 — 백엔드 없이도 콘솔을 둘러볼 수 있게 하기 위함.

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

  if (isDemoMode() && DEMO_CREDENTIALS[rawId] === parsed.data.password) {
    // role 은 lib/operatorRoles.ts 의 OperatorRole 이어야 한다 (admin 은 유효값이 아님) —
    // 데모 계정은 모든 대시보드 경로를 볼 수 있어야 하므로 최고 권한(superadmin) 부여.
    const { jwt, expiresAt } = mintDemoJwt({ role: "superadmin", sub: rawId });
    await writeSession({ jwt, expiresAt });
    redirect("/dashboard");
  }

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
