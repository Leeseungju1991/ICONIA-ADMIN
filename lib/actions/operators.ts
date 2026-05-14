"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import { readIdentityFromJwt } from "@/lib/identity";
import { disableOperator } from "@/lib/adminApi";

export async function disableOperatorAction(formData: FormData) {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const operatorId = String(formData.get("operator_id") || "");
  const reason = String(formData.get("reason") || "");
  if (!operatorId || !reason) return { ok: false, message: "operator_id / reason 누락" };

  // self-disable 차단 — UI 가드와 별개로 server action 단에서도 한 번 더 검증
  // (P0 §5.1.10b / 감사 §2.14). server 측 정책은 별도. 이는 UX-defense layer.
  const identity = readIdentityFromJwt(jwt);
  if (identity?.id && identity.id === operatorId) {
    return { ok: false, message: "본인 계정은 비활성화할 수 없습니다" };
  }

  const res = await disableOperator({ jwt, operatorId, reason });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/operators");
  return { ok: true };
}
