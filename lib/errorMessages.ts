const DEFAULT = "알 수 없는 오류가 발생했습니다.";

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
  ERR_RATE_LIMITED: "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
  ERR_SERVER_UNAVAILABLE: "일시적인 서버 오류입니다. 잠시 후 다시 시도하세요.",
  ERR_NETWORK: "네트워크 연결을 확인해주세요.",
  ERR_INVALID_RESPONSE: "서버 응답을 처리할 수 없습니다.",
  ERR_INTERNAL: "일시적인 서버 오류입니다. 잠시 후 다시 시도하세요.",
};

export function messageForCode(code: string | undefined | null): string {
  if (!code) return DEFAULT;
  return CODE_TO_MESSAGE[code] ?? DEFAULT;
}

const REASON_TO_MESSAGE: Record<string, string> = {
  expired: "세션이 만료되었습니다. 다시 로그인해주세요.",
  invalid: "유효하지 않은 세션입니다.",
  mfa_expired: "MFA 세션이 만료되었습니다. 다시 로그인해주세요.",
};

export function reasonMessage(
  reason: string | undefined | null,
): string | null {
  if (!reason) return null;
  return REASON_TO_MESSAGE[reason] ?? null;
}
