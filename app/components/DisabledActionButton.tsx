// Read-only viewer (또는 기타 role insufficient) 운영자에게 mutating 액션 자리를
// 빈 자리로 두지 않고, disabled 버튼 + tooltip 으로 명시적으로 안내한다 (P2 round).
//
// Server component — 클라이언트 상태 없음. role 조건은 page 단에서 검사한 결과만 받아
// 단순 render. 실제 권한 차단은 서버가 정본 (admin web 은 UX 도움일 뿐).

export type DisabledActionButtonProps = {
  buttonLabel: string;
  buttonClassName?: string;
  /** tooltip 텍스트. 기본 "권한 없음". */
  title?: string;
};

export function DisabledActionButton({
  buttonLabel,
  buttonClassName = "btn small danger",
  title = "권한 없음",
}: DisabledActionButtonProps) {
  return (
    <button
      type="button"
      className={buttonClassName}
      disabled
      aria-disabled="true"
      title={title}
      aria-label={`${buttonLabel} — ${title}`}
      data-testid="role-gated-disabled"
    >
      {buttonLabel}
    </button>
  );
}
