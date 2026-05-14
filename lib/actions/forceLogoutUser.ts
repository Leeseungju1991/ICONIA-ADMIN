"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { forceLogoutUser } from "../adminApi";
import { readSession, clearSession } from "../authCookie";
import type { FormState } from "../types";

const schema = z.object({
  user_id: z.string().min(1).max(64),
  // reason 은 ConfirmActionForm 가 강제 (UI 측 5자 이상). server 측 audit 강화 이전에는
  // optional 로 받아 body 로 전달만 — server 가 무시해도 무방.
  reason: z.string().min(5).max(500).optional(),
});

export async function forceLogoutUserAction(
  formData: FormData,
): Promise<FormState> {
  const jwt = readSession();
  if (!jwt) {
    redirect("/login?reason=expired");
  }

  const reasonRaw = formData.get("reason");
  const parsed = schema.safeParse({
    user_id: formData.get("user_id"),
    reason: typeof reasonRaw === "string" && reasonRaw.length > 0 ? reasonRaw : undefined,
  });
  if (!parsed.success) {
    return { status: "error", code: "ERR_VALIDATION_LOCAL" };
  }

  const result = await forceLogoutUser({
    jwt: jwt!,
    userId: parsed.data.user_id,
    reason: parsed.data.reason,
  });

  if (result.ok) {
    revalidatePath(`/dashboard/users/${parsed.data.user_id}`);
    return {
      status: "idle",
      message: `${result.data.revoked_count}개 세션을 종료했습니다.`,
    };
  }

  if (
    result.code === "ERR_OPERATOR_AUTH_EXPIRED" ||
    result.code === "ERR_OPERATOR_AUTH_INVALID"
  ) {
    clearSession();
    redirect(
      `/login?reason=${result.code === "ERR_OPERATOR_AUTH_EXPIRED" ? "expired" : "invalid"}`,
    );
  }

  return { status: "error", code: result.code, message: result.message };
}
