"use client";

// 운영자 파괴적 액션에 사전 확인 + 사유 입력 강제.
//
// 표 내 액션에 사용 — 서버 액션을 자체 호출하는 클라이언트 컴포넌트.
//   1. confirm("정말 X하시겠어요?")
//   2. (reasonRequired=true 일 때) prompt("사유를 입력하세요 — 최소 5자")
//   3. FormData 구성 후 server action 호출
//
// window.confirm/prompt/alert 유지 — 테스트가 stub 하므로 MUI Dialog 로 바꾸지 않는다.
// MUI Button 으로 스킨만 변경, buttonClassName 은 그대로 forward (DisabledActionButton 과 동일 패턴).

import { useTransition } from "react";
import Button from "@mui/material/Button";

export type ConfirmActionFormProps = {
  action: (formData: FormData) => Promise<unknown>;
  hidden?: Record<string, string>;
  confirmMessage: string;
  reasonRequired?: boolean;
  buttonLabel: string;
  buttonClassName?: string;
};

// buttonClassName 단서로 MUI Button props 추출.
//   "danger" → color="error", "secondary" → variant="outlined", "small" → size="small",
//   "full" → fullWidth.
function deriveButtonProps(className: string) {
  const tokens = className.split(/\s+/).filter(Boolean);
  const isDanger = tokens.includes("danger");
  const isSecondary = tokens.includes("secondary");
  const isSmall = tokens.includes("small");
  const isFull = tokens.includes("full");
  return {
    color: isDanger ? ("error" as const) : ("primary" as const),
    variant: isSecondary ? ("outlined" as const) : ("contained" as const),
    size: isSmall ? ("small" as const) : ("medium" as const),
    fullWidth: isFull,
  };
}

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

  const { color, variant, size, fullWidth } = deriveButtonProps(buttonClassName);

  return (
    <Button
      onClick={onClick}
      disabled={pending}
      className={buttonClassName}
      type="button"
      aria-busy={pending}
      color={color}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
    >
      {pending ? "…" : buttonLabel}
    </Button>
  );
}
