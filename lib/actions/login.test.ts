import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { makeRedirect, expectRedirect, RedirectError } from "../../test/helpers/captureRedirect";

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

describe("loginAction", () => {
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
  });

  it("writes a local session cookie and redirects /dashboard for soom/soom", async () => {
    const url = await expectRedirect(() =>
      loginAction(undefined, fd({ username: "soom", password: "soom" })),
    );
    expect(url).toBe("/dashboard");
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    expect(mockedStep1).not.toHaveBeenCalled();
    const written = cookieStore.set.mock.calls[0][0].value as string;
    const payloadSegment = written.split(".")[1];
    const padded =
      payloadSegment.replace(/-/g, "+").replace(/_/g, "/") +
      "===".slice((payloadSegment.length + 3) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    expect(payload.role).toBe("superadmin");
    expect(payload.sub).toBe("soom");
  });

  it("redirects to /login/mfa with token on mfa_required", async () => {
    mockedStep1.mockResolvedValue({
      ok: true,
      data: { mfa_session_token: "tok-abc", mfa_required: true },
    });
    const url = await expectRedirect(() =>
      loginAction(undefined, fd({ username: "a@b.com", password: "p" })),
    );
    expect(url).toBe("/login/mfa?token=tok-abc");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("writes session cookie + redirects /dashboard when JWT issued directly", async () => {
    mockedStep1.mockResolvedValue({
      ok: true,
      data: {
        jwt: "jwt-xyz",
        expires_at: "2026-05-08T10:30:00.000Z",
        operator: { id: "o1", email: "a@b.com" },
      },
    });
    const url = await expectRedirect(() =>
      loginAction(undefined, fd({ username: "a@b.com", password: "p" })),
    );
    expect(url).toBe("/dashboard");
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    expect(cookieStore.set.mock.calls[0][0].value).toBe("jwt-xyz");
  });

  it("returns ERR_OPERATOR_INVALID_CREDENTIALS error when server says so", async () => {
    mockedStep1.mockResolvedValue({
      ok: false,
      code: "ERR_OPERATOR_INVALID_CREDENTIALS",
      message: "bad",
      status: 401,
    });
    const result = await loginAction(undefined, fd({ username: "a@b.com", password: "p" }));
    expect(result.status).toBe("error");
    expect(result.code).toBe("ERR_OPERATOR_INVALID_CREDENTIALS");
    expect(cookieStore.set).not.toHaveBeenCalled();
  });

  it("propagates redirect on ERR_OPERATOR_SUSPENDED as form error (no redirect)", async () => {
    mockedStep1.mockResolvedValue({
      ok: false,
      code: "ERR_OPERATOR_SUSPENDED",
      message: "x",
      status: 403,
    });
    const result = await loginAction(undefined, fd({ username: "a@b.com", password: "p" }));
    expect(result.status).toBe("error");
    expect(result.code).toBe("ERR_OPERATOR_SUSPENDED");
  });
});

// keep RedirectError used to silence unused-symbol warnings
void RedirectError;
