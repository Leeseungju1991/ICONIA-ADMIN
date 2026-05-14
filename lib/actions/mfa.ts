"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { operatorLoginStep2 } from "../serverApi";
import { writeSession } from "../authCookie";
import type { FormState } from "../types";

const totpSchema = z.object({
  token: z.string().min(1).max(128),
  mode: z.literal("totp"),
  code: z.string().regex(/^[0-9]{6}$/),
});

const recoverySchema = z.object({
  token: z.string().min(1).max(128),
  mode: z.literal("recovery"),
  code: z.string().min(8).max(64),
});

const schema = z.discriminatedUnion("mode", [totpSchema, recoverySchema]);

export async function mfaAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = schema.safeParse({
    token: formData.get("token"),
    mode: formData.get("mode"),
    code: formData.get("code"),
  });
  if (!parsed.success) {
    return { status: "error", code: "ERR_VALIDATION_LOCAL" };
  }

  const args =
    parsed.data.mode === "totp"
      ? { mfaSessionToken: parsed.data.token, totp: parsed.data.code }
      : { mfaSessionToken: parsed.data.token, recoveryCode: parsed.data.code };

  const result = await operatorLoginStep2(args);

  if (result.ok) {
    writeSession({ jwt: result.data.jwt, expiresAt: result.data.expires_at });
    redirect("/dashboard");
  }

  if (result.code === "ERR_OPERATOR_MFA_SESSION_EXPIRED") {
    redirect("/login?reason=mfa_expired");
  }

  return { status: "error", code: result.code, message: result.message };
}
