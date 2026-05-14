"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { operatorLoginStep1 } from "../serverApi";
import { writeSession } from "../authCookie";
import type { FormState } from "../types";

const schema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(256),
});

export async function loginAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = schema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", code: "ERR_VALIDATION_LOCAL" };
  }

  const result = await operatorLoginStep1(parsed.data);

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
