import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeRedirect, expectRedirect } from "../../test/helpers/captureRedirect";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("next/navigation", () => ({
  get redirect() {
    return makeRedirect();
  },
}));
vi.mock("../serverApi", () => ({
  operatorLoginStep2: vi.fn(),
}));

import { operatorLoginStep2 } from "../serverApi";
import { mfaAction } from "./mfa";

const mockedStep2 = operatorLoginStep2 as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.ICONIA_SERVER_URL = "https://api.example.com";
  (process.env as { NODE_ENV?: string }).NODE_ENV = "production";
  cookieStore.set.mockReset();
  mockedStep2.mockReset();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-05-08T10:00:00.000Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

const issuedOk = {
  ok: true as const,
  data: {
    jwt: "jwt-xyz",
    expires_at: "2026-05-08T10:30:00.000Z",
    operator: { id: "o1", email: "a@b.com" },
  },
};

describe("mfaAction (TOTP mode)", () => {
  it("validates totp must be 6 digits", async () => {
    const r = await mfaAction(undefined, fd({ token: "tok", mode: "totp", code: "12" }));
    expect(r.status).toBe("error");
    expect(r.code).toBe("ERR_VALIDATION_LOCAL");
    expect(mockedStep2).not.toHaveBeenCalled();
  });

  it("validates token presence", async () => {
    const r = await mfaAction(undefined, fd({ token: "", mode: "totp", code: "123456" }));
    expect(r.status).toBe("error");
    expect(r.code).toBe("ERR_VALIDATION_LOCAL");
  });

  it("calls server with totp + sets cookie + redirects /dashboard", async () => {
    mockedStep2.mockResolvedValue(issuedOk);
    const url = await expectRedirect(() =>
      mfaAction(undefined, fd({ token: "tok-abc", mode: "totp", code: "654321" })),
    );
    expect(url).toBe("/dashboard");
    expect(mockedStep2).toHaveBeenCalledWith({
      mfaSessionToken: "tok-abc",
      totp: "654321",
    });
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
  });
});

describe("mfaAction (recovery mode)", () => {
  it("calls server with recovery_code", async () => {
    mockedStep2.mockResolvedValue(issuedOk);
    await expectRedirect(() =>
      mfaAction(undefined, fd({ token: "tok-abc", mode: "recovery", code: "abcd-efgh" })),
    );
    expect(mockedStep2).toHaveBeenCalledWith({
      mfaSessionToken: "tok-abc",
      recoveryCode: "abcd-efgh",
    });
  });

  it("rejects recovery code shorter than 8 chars", async () => {
    const r = await mfaAction(undefined, fd({ token: "tok", mode: "recovery", code: "tiny" }));
    expect(r.status).toBe("error");
    expect(r.code).toBe("ERR_VALIDATION_LOCAL");
  });
});

describe("mfaAction (errors)", () => {
  it("returns ERR_OPERATOR_MFA_INVALID without setting cookie", async () => {
    mockedStep2.mockResolvedValue({
      ok: false,
      code: "ERR_OPERATOR_MFA_INVALID",
      message: "x",
      status: 401,
    });
    const r = await mfaAction(
      undefined,
      fd({ token: "tok", mode: "totp", code: "111111" }),
    );
    expect(r.status).toBe("error");
    expect(r.code).toBe("ERR_OPERATOR_MFA_INVALID");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("on ERR_OPERATOR_MFA_SESSION_EXPIRED redirects to /login?reason=mfa_expired", async () => {
    mockedStep2.mockResolvedValue({
      ok: false,
      code: "ERR_OPERATOR_MFA_SESSION_EXPIRED",
      message: "x",
      status: 401,
    });
    const url = await expectRedirect(() =>
      mfaAction(undefined, fd({ token: "tok", mode: "totp", code: "222222" })),
    );
    expect(url).toBe("/login?reason=mfa_expired");
  });
});
