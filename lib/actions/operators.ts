"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import { resolveIdentity } from "@/lib/identity";
import {
  createOperator,
  disableOperator,
  listOperators,
  type CreateOperatorResponse,
  type OperatorRow,
} from "@/lib/adminApi";
import type { OperatorRole } from "@/lib/operatorRoles";
import { ALL_ROLES } from "@/lib/operatorRoles";

export type DisableOperatorResult = { ok: true } | { ok: false; message: string };

export async function disableOperatorAction(
  formData: FormData,
): Promise<DisableOperatorResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const operatorId = String(formData.get("operator_id") || "");
  const reason = String(formData.get("reason") || "");
  if (!operatorId || !reason) return { ok: false, message: "operator_id / reason 누락" };
  // server action 단에서도 사유 5자 강제 — UI 가드 우회 차단 (감사 §2.4).
  if (reason.trim().length < 5) {
    return { ok: false, message: "비활성화 사유는 5자 이상이어야 합니다" };
  }

  // self-disable 차단 — UI 가드와 별개로 server action 단에서도 한 번 더 검증
  // (P0 §5.1.10b / 감사 §2.14). server 측 정책은 별도. 이는 UX-defense layer.
  // Server `/api/v1/operator/me` 서명검증 신원으로 본인 id 를 확인 — 위·변조된
  // JWT payload 로 self-disable 가드를 우회하는 경로를 차단한다.
  const identity = await resolveIdentity(jwt);
  if (identity?.id && identity.id === operatorId) {
    return { ok: false, message: "본인 계정은 비활성화할 수 없습니다" };
  }

  const res = await disableOperator({ jwt, operatorId, reason: reason.trim() });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/operators");
  return { ok: true };
}

export type ListOperatorsResult =
  | { ok: true; operators: OperatorRow[] }
  | { ok: false; message: string };

/**
 * 운영자 목록 조회 — server-side. JWT 는 httpOnly 쿠키에서만 읽어 client 노출 차단.
 * Server 라우트 `GET /api/v1/operator/admin/operators` (superadmin 전용) 와 정합.
 * 에러는 호출자(페이지)가 명확한 에러 상태로 렌더할 수 있도록 message 로 반환.
 */
export async function listOperatorsAction(): Promise<ListOperatorsResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다. 다시 로그인하세요." };
  const res = await listOperators({ jwt });
  if (!res.ok) {
    return { ok: false, message: `운영자 목록을 불러오지 못했습니다 (${res.code}).` };
  }
  return { ok: true, operators: res.data.operators };
}

// 2026-06-02 — superadmin 이 신규 운영자(viewer 등)를 즉시 생성.
//   - 서버 정책: 비밀번호 12자+ (영문/숫자/특수) — checkPasswordPolicy.
//   - 본 action 은 1차 client 검증 (12자+) 후 server 에 위임 — 422 시 그대로 노출.
//   - role 은 ALL_ROLES (cs/sre/secops/superadmin/viewer) 중 하나.
//   - 응답에 1회용 totp_secret_base32 + otpauth_uri + recovery_codes 포함 (caller 가
//     UI 에 1회 노출 후 폐기 — 본 action 은 그대로 통과).
export type CreateOperatorResult =
  | { ok: true; data: CreateOperatorResponse }
  | { ok: false; message: string; code?: string };

export async function createOperatorAction(args: {
  email: string;
  password: string;
  role: OperatorRole;
}): Promise<CreateOperatorResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다. 다시 로그인하세요." };
  const email = args.email.trim().toLowerCase();
  if (!email || !email.includes("@")) {
    return { ok: false, message: "이메일 형식이 올바르지 않습니다." };
  }
  if (!args.password || args.password.length < 12) {
    return {
      ok: false,
      message: "비밀번호는 12자 이상이어야 합니다 (영문+숫자+특수 포함).",
    };
  }
  if (!(ALL_ROLES as readonly string[]).includes(args.role)) {
    return { ok: false, message: "역할이 올바르지 않습니다." };
  }
  const res = await createOperator({
    jwt,
    email,
    password: args.password,
    role: args.role,
  });
  if (!res.ok) {
    return { ok: false, message: `${res.code ?? "ERR"}: ${res.message}`, code: res.code };
  }
  revalidatePath("/dashboard/operators");
  return { ok: true, data: res.data };
}
