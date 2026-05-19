"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { operatorLoginStep1 } from "../serverApi";
import { writeSession } from "../authCookie";
import type { FormState } from "../types";

// P0 보안 정상화 (2026-05-19):
//   - 이전 라운드의 `soom/soom` local bypass + alg:none JWT 발급 dead code 완전 제거.
//   - 본 server action 은 오직 Server 측 `/api/v1/operator/login` 만 호출한다.
//   - 자격증명 검증/JWT 발급/세션 만료 — 전 권한은 Server 가 보유.

const schema = z.object({
  username: z.string().min(1).max(254),
  password: z.string().min(1).max(256),
});

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

  const result = await operatorLoginStep1({
    email: parsed.data.username,
    password: parsed.data.password,
  });

  if (result.ok) {
    if ("mfa_required" in result.data && result.data.mfa_required) {
      const token = encodeURIComponent(result.data.mfa_session_token);
      redirect(`/login/mfa?token=${token}`);
    }
    if ("jwt" in result.data) {
      writeSession({
        jwt: result.data.jwt,
        expiresAt: result.data.expires_at,
      });
      redirect("/dashboard");
    }
    return { status: "error", code: "ERR_INVALID_RESPONSE" };
  }

  return { status: "error", code: result.code, message: result.message };
}
