"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { forceLogoutUser } from "../adminApi";
import { readSession, clearSession } from "../authCookie";
import type { FormState } from "../types";

const schema = z.object({ user_id: z.string().min(1).max(64) });

export async function forceLogoutUserAction(
  formData: FormData,
): Promise<FormState> {
  const jwt = readSession();
  if (!jwt) {
    redirect("/login?reason=expired");
  }

  const parsed = schema.safeParse({ user_id: formData.get("user_id") });
  if (!parsed.success) {
    return { status: "error", code: "ERR_VALIDATION_LOCAL" };
  }

  const result = await forceLogoutUser({
    jwt: jwt!,
    userId: parsed.data.user_id,
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
