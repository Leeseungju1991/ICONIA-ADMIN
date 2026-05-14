"use client";

// 사용자 강제 로그아웃 — refresh family 전체 revoke. 파괴적 액션이라
// ConfirmActionForm 으로 확인 + 5자 사유 강제 (P0 §5.1.10b / 감사 §2.14).
//
// 결과 메시지(`{ revoked_count }`) 노출은 reason-prompt 후 transition 내부에서 일어나므로
// 별도 state 표시 없음 — 운영자는 페이지 reload(revalidate) 결과로 결과 확인.

import { ConfirmActionForm } from "@/app/components/ConfirmActionForm";
import { forceLogoutUserAction } from "@/lib/actions/forceLogoutUser";

export function ForceLogoutButton({ userId }: { userId: string }) {
  return (
    <ConfirmActionForm
      action={forceLogoutUserAction}
      hidden={{ user_id: userId }}
      confirmMessage={`이 사용자의 모든 세션을 강제로 종료하시겠어요?\n\n사용자는 즉시 로그아웃됩니다.`}
      reasonRequired
      buttonLabel="강제 로그아웃 (모든 세션 revoke)"
      buttonClassName="btn danger"
    />
  );
}
