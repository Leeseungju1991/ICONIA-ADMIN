"use client";

// 운영자 파괴적 액션에 사전 확인 + 사유 입력 강제.
//
// 표 내 액션에 사용 — 서버 액션을 자체 호출하는 세는 클라이언트 컴포넌트.
//   1. confirm("정말 X하시겠어요?")
//   2. (reasonRequired=true 일 때) prompt("사유를 입력하세요 — 최소 5자")
//   3. FormData 구성 후 server action 호출
//
// 권장: hide/unhide, force-unpair, mark-lost, disable 등 돌이키기 따로 조작이 드는 액션에
// 모두 적용. 일반 조회/삭제 아닌 트리거 액션은 일반 form 그대로 사용.

import { useTransition } from "react";

export type ConfirmActionFormProps = {
  action: (formData: FormData) => Promise<unknown>;
  hidden?: Record<string, string>;
  confirmMessage: string;
  reasonRequired?: boolean;
  buttonLabel: string;
  buttonClassName?: string;
};

export function ConfirmActionForm({
  action,
  hidden,
  confirmMessage,
  reasonRequired = true,
  buttonLabel,
  buttonClassName = "btn small danger",
}: ConfirmActionFormProps) {
  const [pending, startTransition] = useTransition();

  const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (typeof window === "undefined") return;
    if (!window.confirm(confirmMessage)) return;
    let reason = "";
    if (reasonRequired) {
      const input = window.prompt("사유를 입력하세요 (최소 5자, audit 로그에 포함됩니다):");
      if (input === null) return; // 취소
      reason = input.trim();
      if (reason.length < 5) {
        window.alert("사유가 너무 짧습니다. 최소 5자 이상 입력해 주세요.");
        return;
      }
    }
    const fd = new FormData();
    if (hidden) {
      for (const [k, v] of Object.entries(hidden)) fd.set(k, v);
    }
    if (reasonRequired) fd.set("reason", reason);
    startTransition(() => {
      void action(fd);
    });
  };

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className={buttonClassName}
      type="button"
      aria-busy={pending}
    >
      {pending ? "…" : buttonLabel}
    </button>
  );
}
