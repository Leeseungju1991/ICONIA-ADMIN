"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import { disableOperator } from "@/lib/adminApi";

export async function disableOperatorAction(formData: FormData) {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const operatorId = String(formData.get("operator_id") || "");
  const reason = String(formData.get("reason") || "");
  if (!operatorId || !reason) return { ok: false, message: "operator_id / reason 누락" };
  const res = await disableOperator({ jwt, operatorId, reason });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/operators");
  return { ok: true };
}
