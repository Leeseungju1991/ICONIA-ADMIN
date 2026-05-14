const DEFAULT = "알 수 없는 오류가 발생했습니다.";

// 공통 에러 코드 → 한국어 매핑.
// 신규 코드 추가 시 서버 측 error code catalog (Server/src/errorCodes 등) 와 동기화.
// dashboard raw 출력 ({res.code}: {res.message}) 제거 작업은 P1 §5.2 #12 참조.
const CODE_TO_MESSAGE: Record<string, string> = {
  ERR_VALIDATION: "입력값을 확인해주세요.",
  ERR_VALIDATION_LOCAL: "입력값을 확인해주세요.",
  ERR_OPERATOR_INVALID_CREDENTIALS:
    "이메일 또는 비밀번호가 올바르지 않습니다.",
  ERR_OPERATOR_SUSPENDED: "계정이 정지되었습니다. 관리자에게 문의하세요.",
  ERR_OPERATOR_MFA_INVALID: "인증 코드가 올바르지 않습니다.",
  ERR_OPERATOR_MFA_SESSION_EXPIRED:
    "MFA 세션이 만료되었습니다. 다시 로그인해주세요.",
  ERR_OPERATOR_AUTH_EXPIRED: "세션이 만료되었습니다. 다시 로그인해주세요.",
  ERR_OPERATOR_AUTH_INVALID: "유효하지 않은 세션입니다.",
  ERR_OPERATOR_NOT_AUTHORIZED: "이 작업을 수행할 권한이 없습니다.",
  ERR_NOT_AUTHORIZED: "이 작업을 수행할 권한이 없습니다.",
  ERR_AUTH_EXPIRED: "세션이 만료되었습니다. 다시 로그인해주세요.",
  ERR_FORBIDDEN: "이 작업을 수행할 권한이 없습니다.",
  ERR_NOT_FOUND: "해당 자원을 찾을 수 없습니다.",
  ERR_CONFLICT: "현재 상태와 충돌하여 처리하지 못했습니다.",
  ERR_RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
  ERR_SERVER_UNAVAILABLE: "일시적인 서버 오류입니다. 잠시 후 다시 시도하세요.",
  ERR_NETWORK: "네트워크 연결을 확인해주세요.",
  ERR_INVALID_RESPONSE: "서버 응답을 처리할 수 없습니다.",
  ERR_INTERNAL: "일시적인 서버 오류입니다. 잠시 후 다시 시도하세요.",
  ERR_TIMEOUT: "요청 시간이 초과되었습니다. 잠시 후 다시 시도하세요.",
  ERR_OPERATOR_IDLE_TIMEOUT:
    "장시간 사용하지 않아 자동 로그아웃되었습니다.",
};

// 두 번째 인자(`fallback`) 는 호출부가 서버에서 받은 raw message 를 그대로 넘겨
// 매핑이 없는 코드에 대해 "처리 중 오류가 발생했습니다." 보다 더 구체적인 정보를
// 표시할 수 있게 한다. fallback 도 비어 있으면 DEFAULT.
export function messageForCode(
  code: string | undefined | null,
  fallback?: string | undefined | null,
): string {
  if (!code) {
    const trimmed = fallback?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : DEFAULT;
  }
  const mapped = CODE_TO_MESSAGE[code];
  if (mapped) return mapped;
  const trimmed = fallback?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : DEFAULT;
}

const REASON_TO_MESSAGE: Record<string, string> = {
  expired: "세션이 만료되었습니다. 다시 로그인해주세요.",
  invalid: "유효하지 않은 세션입니다.",
  mfa_expired: "MFA 세션이 만료되었습니다. 다시 로그인해주세요.",
  idle: "장시간 사용하지 않아 자동 로그아웃되었습니다. 다시 로그인해주세요.",
};

export function reasonMessage(
  reason: string | undefined | null,
): string | null {
  if (!reason) return null;
  return REASON_TO_MESSAGE[reason] ?? null;
}
