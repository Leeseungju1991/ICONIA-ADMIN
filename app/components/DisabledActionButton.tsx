// Read-only viewer (또는 기타 role insufficient) 운영자에게 mutating 액션 자리를
// 빈 자리로 두지 않고, disabled 버튼 + tooltip 으로 명시적으로 안내한다 (P2 round).
//
// Server component — 클라이언트 상태 없음. role 조건은 page 단에서 검사한 결과만 받아
// 단순 render. 실제 권한 차단은 서버가 정본 (admin web 은 UX 도움일 뿐).
// MUI Button 으로 재스킨. className/title/aria/data-testid 보존 — 테스트 호환.

import Button from "@mui/material/Button";

export type DisabledActionButtonProps = {
  buttonLabel: string;
  buttonClassName?: string;
  /** tooltip 텍스트. 기본 "권한 없음". */
  title?: string;
};

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

export function DisabledActionButton({
  buttonLabel,
  buttonClassName = "btn small danger",
  title = "권한 없음",
}: DisabledActionButtonProps) {
  const { color, variant, size, fullWidth } = deriveButtonProps(buttonClassName);
  return (
    <Button
      type="button"
      className={buttonClassName}
      disabled
      aria-disabled="true"
      title={title}
      aria-label={`${buttonLabel} — ${title}`}
      data-testid="role-gated-disabled"
      color={color}
      variant={variant}
      size={size}
      fullWidth={fullWidth}
    >
      {buttonLabel}
    </Button>
  );
}
