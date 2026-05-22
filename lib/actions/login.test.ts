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

describe("loginAction (dev/demo soom/soom only)", () => {
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

  it("writes session cookie + redirects /dashboard on soom/soom", async () => {
    const url = await expectRedirect(() =>
      loginAction(undefined, fd({ username: "soom", password: "soom" })),
    );
    expect(url).toBe("/dashboard");
    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    const cookieArg = cookieStore.set.mock.calls[0][0];
    expect(cookieArg.name).toBe("iconia_admin_session");
    expect(cookieArg.httpOnly).toBe(true);
    // alg:none JWT — header.payload. (signature 비어있음)
    expect(typeof cookieArg.value).toBe("string");
    const parts = (cookieArg.value as string).split(".");
    expect(parts).toHaveLength(3);
    const payload = JSON.parse(
      Buffer.from(
        parts[1].replace(/-/g, "+").replace(/_/g, "/") +
          "===".slice((parts[1].length + 3) % 4),
        "base64",
      ).toString("utf8"),
    );
    expect(payload.role).toBe("superadmin");
    expect(payload.sub).toBe("soom");
    expect(typeof payload.exp).toBe("number");
    expect(payload.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    expect(mockedStep1).not.toHaveBeenCalled();
  });

  it("rejects any non-soom username with ERR_OPERATOR_INVALID_CREDENTIALS", async () => {
    const result = await loginAction(
      undefined,
      fd({ username: "admin", password: "soom" }),
    );
    expect(result.status).toBe("error");
    expect(result.code).toBe("ERR_OPERATOR_INVALID_CREDENTIALS");
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(mockedStep1).not.toHaveBeenCalled();
  });

  it("rejects any non-soom password with ERR_OPERATOR_INVALID_CREDENTIALS", async () => {
    const result = await loginAction(
      undefined,
      fd({ username: "soom", password: "wrong" }),
    );
    expect(result.status).toBe("error");
    expect(result.code).toBe("ERR_OPERATOR_INVALID_CREDENTIALS");
    expect(cookieStore.set).not.toHaveBeenCalled();
    expect(mockedStep1).not.toHaveBeenCalled();
  });

  it("never calls the server API — dev/demo is purely local", async () => {
    await loginAction(undefined, fd({ username: "a@b.com", password: "x" }));
    await loginAction(undefined, fd({ username: "soom", password: "soom" })).catch(
      () => {
        /* redirect throws — expected */
      },
    );
    expect(mockedStep1).not.toHaveBeenCalled();
  });
});

// keep RedirectError used to silence unused-symbol warnings
void RedirectError;
