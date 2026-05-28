"use server";

// (주)숨코리아 출시 정비 — 운영팀 수동 사용자 추가 server action.
//
// Server `/api/v1/admin/users` (POST) 호출. Bearer JWT 는 httpOnly 쿠키에서만
// 읽으며 브라우저는 plaintext password 만 한 번 전달한다. 응답 user 객체의
// password_hash 등 민감 필드는 Server 에서 의도적으로 제외된다.

import { readSession } from "@/lib/authCookie";
import {
  createAdminUser,
  type AdminCreatedUser,
} from "@/lib/adminApi";

export type CreateAdminUserResult =
  | { ok: true; data: AdminCreatedUser }
  | { ok: false; message: string; code?: string };

export type CreateAdminUserInputClient = {
  email: string;
  password: string;
  displayName?: string;
  role?: "user" | "operator" | "admin";
  autoVerified?: boolean;
  agreedTermsVersion: string;
  ageVerified: boolean;
  reason: string;
};

/** 단순 client-side 와 동일한 1차 검증 — server 가 정합 검증을 다시 한다. */
function validateInput(input: CreateAdminUserInputClient): string | null {
  if (!input.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) {
    return "이메일 형식이 올바르지 않습니다.";
  }
  if (!input.password || input.password.length < 8) {
    return "비밀번호는 8자 이상이어야 합니다.";
  }
  if (!input.agreedTermsVersion || input.agreedTermsVersion.trim().length === 0) {
    return "약관 버전을 지정하세요.";
  }
  if (!input.ageVerified) {
    return "19세 이상 본인 확인 체크가 필요합니다.";
  }
  if (!input.reason || input.reason.trim().length < 5) {
    return "운영자 사유는 5자 이상 입력하세요.";
  }
  if (input.reason.length > 256) {
    return "사유는 256자 이하로 입력하세요.";
  }
  return null;
}

export async function createAdminUserAction(
  input: CreateAdminUserInputClient,
): Promise<CreateAdminUserResult> {
  const jwt = readSession();
  if (!jwt) {
    return { ok: false, message: "세션이 만료되었습니다. 다시 로그인하세요.", code: "ERR_UNAUTHORIZED" };
  }
  const v = validateInput(input);
  if (v) return { ok: false, message: v, code: "ERR_VALIDATION" };

  const res = await createAdminUser({
    jwt,
    email: input.email.trim(),
    password: input.password,
    displayName: input.displayName?.trim() || undefined,
    role: input.role ?? "user",
    autoVerified: input.autoVerified ?? true,
    agreedTermsVersion: input.agreedTermsVersion.trim(),
    ageVerified: input.ageVerified,
    reason: input.reason.trim(),
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
