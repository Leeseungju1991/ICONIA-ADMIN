import { describe, it, expect } from "vitest";
import { messageForCode, reasonMessage } from "./errorMessages";

describe("messageForCode", () => {
  it("returns mapped Korean message for known codes", () => {
    expect(messageForCode("ERR_OPERATOR_INVALID_CREDENTIALS")).toBe(
      "이메일 또는 비밀번호가 올바르지 않습니다.",
    );
    expect(messageForCode("ERR_OPERATOR_MFA_INVALID")).toBe(
      "인증 코드가 올바르지 않습니다.",
    );
    expect(messageForCode("ERR_RATE_LIMITED")).toBe(
      "요청이 너무 많습니다. 잠시 후 다시 시도하세요.",
    );
  });

  it("returns default fallback for unknown code", () => {
    expect(messageForCode("ERR_THAT_DOES_NOT_EXIST")).toBe(
      "알 수 없는 오류가 발생했습니다.",
    );
  });

  it("returns default fallback for empty/undefined code", () => {
    expect(messageForCode(undefined)).toBe("알 수 없는 오류가 발생했습니다.");
    expect(messageForCode("")).toBe("알 수 없는 오류가 발생했습니다.");
  });

  it("falls back to server message text when code is unmapped", () => {
    // mapped code: code 우선
    expect(
      messageForCode("ERR_NETWORK", "raw upstream text"),
    ).toBe("네트워크 연결을 확인해주세요.");
    // unmapped code + raw text: raw 사용
    expect(
      messageForCode("ERR_THAT_DOES_NOT_EXIST", "missing field: cohort_id"),
    ).toBe("missing field: cohort_id");
    // unmapped code + 빈 raw: DEFAULT
    expect(
      messageForCode("ERR_THAT_DOES_NOT_EXIST", ""),
    ).toBe("알 수 없는 오류가 발생했습니다.");
    // 빈 code + raw: raw 사용
    expect(messageForCode(undefined, "rate limit")).toBe("rate limit");
  });

  it("maps newly added common error codes to Korean", () => {
    expect(messageForCode("ERR_NOT_AUTHORIZED")).toBe(
      "이 작업을 수행할 권한이 없습니다.",
    );
    expect(messageForCode("ERR_AUTH_EXPIRED")).toBe(
      "세션이 만료되었습니다. 다시 로그인해주세요.",
    );
    expect(messageForCode("ERR_NOT_FOUND")).toBe(
      "해당 자원을 찾을 수 없습니다.",
    );
    expect(messageForCode("ERR_TIMEOUT")).toBe(
      "요청 시간이 초과되었습니다. 잠시 후 다시 시도하세요.",
    );
    expect(messageForCode("ERR_OPERATOR_IDLE_TIMEOUT")).toBe(
      "장시간 사용하지 않아 자동 로그아웃되었습니다.",
    );
  });
});

describe("reasonMessage", () => {
  it("maps query reason keys to user message", () => {
    expect(reasonMessage("expired")).toBe(
      "세션이 만료되었습니다. 다시 로그인해주세요.",
    );
    expect(reasonMessage("invalid")).toBe("유효하지 않은 세션입니다.");
    expect(reasonMessage("mfa_expired")).toBe(
      "MFA 세션이 만료되었습니다. 다시 로그인해주세요.",
    );
    expect(reasonMessage("idle")).toBe(
      "장시간 사용하지 않아 자동 로그아웃되었습니다. 다시 로그인해주세요.",
    );
  });

  it("returns null for unknown reason", () => {
    expect(reasonMessage("unknown")).toBeNull();
    expect(reasonMessage(undefined)).toBeNull();
    expect(reasonMessage(null)).toBeNull();
  });
});
