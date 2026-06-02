import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeRedirect, expectRedirect, RedirectError } from "../../test/helpers/captureRedirect";

// 2026-06-02 — 본 테스트는 출시 정합 라운드 J 에서 갱신됨.
// 과거에는 dev/demo 전용 "soom/soom" 로컬 분기를 검증했으나, 현재 loginAction 은
//   1) zod validation → 2) operatorLoginStep1 (Server /api/v1/operator/login) 호출
//   3) mfa_required=false 면 writeSession + redirect(/dashboard)
//   4) mfa_required=true 면 ERR_OPERATOR_MFA_REQUIRED 반환
// 의 정식 플로우만 가진다. 본 테스트는 그 정식 플로우를 검증한다.

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };

vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("next/navigation", () => ({
  get redirect() {
    return makeRedirect();
  },
}));

vi.mock("../serverApi", () => ({
  operatorLoginStep1: vi.fn(),
}));

import { operatorLoginStep1 } from "../serverApi";
import { loginAction } from "./login";

const mockedStep1 = operatorLoginStep1 as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.ICONIA_SERVER_URL = "https://api.example.com";
  (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  cookieStore.get.mockReset();
  mockedStep1.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-06-02T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

describe("loginAction (server-backed operator login)", () => {
  it("returns ERR_VALIDATION_LOCAL when username missing", async () => {
    const result = await loginAction(undefined, fd({ password: "p" }));
    expect(result.status).toBe("error");
    expect(result.code).toBe("ERR_VALIDATION_LOCAL");
    expect(mockedStep1).not.toHaveBeenCalled();
  });

  it("returns ERR_VALIDATION_LOCAL when password missing", async () => {
    const result = await loginAction(undefined, fd({ username: "operator" }));
    expect(result.status).toBe("error");
    expect(result.code).toBe("ERR_VALIDATION_LOCAL");
    expect(mockedStep1).not.toHaveBeenCalled();
  });

  it("suffixes bare username with default email domain (soomkorea.com)", async () => {
    mockedStep1.mockResolvedValue({
      ok: false,
      code: "ERR_OPERATOR_INVALID_CREDENTIALS",
      message: "invalid",
    });
    await loginAction(undefined, fd({ username: "operator", password: "pw" }));
    expect(mockedStep1).toHaveBeenCalledTimes(1);
    expect(mockedStep1).toHaveBeenCalledWith({
      email: "operator@soomkorea.com",
      password: "pw",
    });
  });

  it("passes through email when username already contains @", async () => {
    mockedStep1.mockResolvedValue({
      ok: false,
      code: "ERR_OPERATOR_INVALID_CREDENTIALS",
      message: "invalid",
    });
    await loginAction(undefined, fd({ username: "alice@example.com", password: "pw" }));
    expect(mockedStep1).toHaveBeenCalledWith({
      email: "alice@example.com",
      password: "pw",
    });
  });

  it("writes session cookie + redirects /dashboard when server issues access_token", async () => {
    mockedStep1.mockResolvedValue({
      ok: true,
      data: {
        mfa_required: false,
        access_token: "jwt-xyz",
        access_token_expires_in_sec: 3600,
        session_id: "sid",
        operator: { id: "op-1", email: "soom@soomkorea.com", role: "superadmin" },
      },
    });
    const url = await expectRedirect(() =>
      loginAction(undefined, fd({ username: "soom", password: "soom" })),
    );
    expect(url).toBe("/dashboard");
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const cookieArg = cookieStore.set.mock.calls[0][0];
    expect(cookieArg.name).toBe("iconia_admin_session");
    expect(cookieArg.httpOnly).toBe(true);
    expect(typeof cookieArg.value).toBe("string");
  });

  it("surfaces ERR_OPERATOR_INVALID_CREDENTIALS from server", async () => {
    mockedStep1.mockResolvedValue({
      ok: false,
      code: "ERR_OPERATOR_INVALID_CREDENTIALS",
      message: "invalid_credentials",
    });
    const result = await loginAction(
      undefined,
      fd({ username: "admin", password: "wrong" }),
    );
    expect(result.status).toBe("error");
    expect(result.code).toBe("ERR_OPERATOR_INVALID_CREDENTIALS");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("returns ERR_OPERATOR_MFA_REQUIRED when server response lacks access_token (mfa flow)", async () => {
    mockedStep1.mockResolvedValue({
      ok: true,
      data: { mfa_required: true, mfa_challenge_id: "ch1" },
    });
    const result = await loginAction(
      undefined,
      fd({ username: "mfauser", password: "pw" }),
    );
    expect(result.status).toBe("error");
    expect(result.code).toBe("ERR_OPERATOR_MFA_REQUIRED");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });
});

// keep RedirectError used to silence unused-symbol warnings
void RedirectError;
