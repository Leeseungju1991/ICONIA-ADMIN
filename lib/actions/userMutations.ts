"use server";

// V1.0 #1 — 사용자 admin mutation server actions.
//
// 라운드 4 (2026-05-21) 까지는 users 페이지의 강력 액션이 audit log 만 기록하고
// 실제 Server mutation 은 호출하지 않았다 (P1 §5). Phase1-A 가 Server 에
// pause/resume/mfa-reset endpoint 를 추가하면서 본 server action 들이 mutation
// 을 호출할 수 있게 된다.
//
// 각 action 은 (1) audit log 자동 기록 (Server 측), (2) UUID 검증, (3) 사유 5자
// 이상 강제, (4) JWT 는 httpOnly 쿠키에서만 읽음.

import { readSession } from "@/lib/authCookie";
import {
  forceLogoutUser,
  pauseUser,
  resumeUser,
  mfaResetUser,
} from "@/lib/adminApi";

export type UserMutationResult =
  | { ok: true; note?: string }
  | { ok: false; message: string; code?: string };

function validateReason(reason: string): string | null {
  if (!reason || reason.trim().length < 5) {
    return "사유는 5자 이상 입력해야 합니다.";
  }
  return null;
}

export async function forceLogoutUserAction(args: {
  userId: string;
  reason: string;
}): Promise<UserMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다. 다시 로그인하세요." };
  const v = validateReason(args.reason);
  if (v) return { ok: false, message: v };
  const res = await forceLogoutUser({ jwt, userId: args.userId, reason: args.reason.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true };
}

export async function pauseUserAction(args: {
  userId: string;
  reason: string;
}): Promise<UserMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다. 다시 로그인하세요." };
  const v = validateReason(args.reason);
  if (v) return { ok: false, message: v };
  const res = await pauseUser({ jwt, userId: args.userId, reason: args.reason.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    note: res.data.already_paused ? "이미 일시정지 상태였습니다." : undefined,
  };
}

export async function resumeUserAction(args: {
  userId: string;
  reason: string;
}): Promise<UserMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다. 다시 로그인하세요." };
  const v = validateReason(args.reason);
  if (v) return { ok: false, message: v };
  const res = await resumeUser({ jwt, userId: args.userId, reason: args.reason.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    note: res.data.already_active ? "이미 활성 상태였습니다." : undefined,
  };
}

export async function mfaResetUserAction(args: {
  userId: string;
  reason: string;
}): Promise<UserMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다. 다시 로그인하세요." };
  const v = validateReason(args.reason);
  if (v) return { ok: false, message: v };
  const res = await mfaResetUser({ jwt, userId: args.userId, reason: args.reason.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    note: res.data.was_enrolled ? "MFA 가 등록 해제되었습니다." : "MFA 가 비등록 상태였습니다 — 변화 없음.",
  };
}
