"use server";

// 운영자 초대 — Server 정본 endpoint(`/api/v1/operator/admin/operators/invite`)
// 도입 후 실 mutation. 본 라운드는 client 시그니처 + audit-only stub.

import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";

export type InviteOperatorResult =
  | { ok: true; invite_id: string; email: string; token_expires_at: string }
  | { ok: false; message: string; code?: string };

export async function inviteOperatorAction(
  formData: FormData,
): Promise<InviteOperatorResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const email = String(formData.get("email") || "").trim();
  const role = String(formData.get("role") || "viewer");
  const reason = String(formData.get("reason") || "");
  if (!email || !email.includes("@")) {
    return { ok: false, message: "이메일 형식 오류" };
  }
  if (reason.trim().length < 5) {
    return { ok: false, message: "초대 사유는 5자 이상 필요합니다" };
  }
  if (!["superadmin", "sre", "secops", "cs", "viewer"].includes(role)) {
    return { ok: false, message: "역할 오류" };
  }

  // B18 — Server `/api/v1/operator/admin/operators/invite` 미배포.
  // 호출은 유지하되 404/5xx 시 graceful 알림으로 출시 시 콘솔 에러 차단.
  try {
    const res = await authedRequest<{
      invite_id: string;
      email: string;
      token_expires_at: string;
    }>({
      jwt,
      path: "/api/v1/operator/admin/operators/invite",
      method: "POST",
      body: { email, role, reason: reason.trim() },
    });

    if (!res.ok) {
      // 서버 라우트 미배포 — 운영자에게 친절한 안내.
      return {
        ok: false,
        message: "초대 기능은 곧 제공됩니다.",
        code: res.code,
      };
    }
    return {
      ok: true,
      invite_id: res.data.invite_id,
      email: res.data.email,
      token_expires_at: res.data.token_expires_at,
    };
  } catch {
    return {
      ok: false,
      message: "초대 기능은 곧 제공됩니다.",
      code: "ERR_NOT_IMPLEMENTED",
    };
  }
}
