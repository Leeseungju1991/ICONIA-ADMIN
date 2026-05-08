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
  });

  it("returns null for unknown reason", () => {
    expect(reasonMessage("unknown")).toBeNull();
    expect(reasonMessage(undefined)).toBeNull();
    expect(reasonMessage(null)).toBeNull();
  });
});
