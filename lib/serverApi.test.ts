import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  operatorLoginStep1,
  operatorLoginStep2,
  operatorLogout,
} from "./serverApi";

const BASE = "https://api.example.com";

beforeEach(() => {
  process.env.ICONIA_SERVER_URL = BASE;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(input: {
  status: number;
  body: unknown;
  bodyText?: string;
}) {
  const body = input.bodyText ?? JSON.stringify(input.body);
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body, {
      status: input.status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("operatorLoginStep1", () => {
  it("returns ok on 200 + ok envelope", async () => {
    mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { mfa_session_token: "tok123", mfa_required: true },
        error: null,
      },
    });
    const r = await operatorLoginStep1({
      email: "a@b.com",
      password: "secret123",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data).toEqual({
        mfa_session_token: "tok123",
        mfa_required: true,
      });
    }
  });

  it("posts to /api/v1/operator/login with JSON body", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { mfa_session_token: "x", mfa_required: true },
        error: null,
      },
    });
    await operatorLoginStep1({ email: "a@b.com", password: "p" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/operator/login`);
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      email: "a@b.com",
      password: "p",
    });
  });

  it("returns err on 4xx with error envelope", async () => {
    mockFetchOnce({
      status: 401,
      body: {
        ok: false,
        data: null,
        error: {
          code: "ERR_OPERATOR_INVALID_CREDENTIALS",
          message: "bad",
        },
      },
    });
    const r = await operatorLoginStep1({
      email: "a@b.com",
      password: "wrong",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_OPERATOR_INVALID_CREDENTIALS");
      expect(r.status).toBe(401);
    }
  });

  it("returns ERR_SERVER_UNAVAILABLE on 5xx", async () => {
    mockFetchOnce({
      status: 503,
      body: { ok: false, data: null, error: { code: "X", message: "y" } },
    });
    const r = await operatorLoginStep1({ email: "a@b.com", password: "p" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });

  it("returns ERR_NETWORK on fetch throw", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("nope"));
    vi.stubGlobal("fetch", fetchMock);
    const r = await operatorLoginStep1({ email: "a@b.com", password: "p" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });

  it("returns ERR_INVALID_RESPONSE on non-JSON body", async () => {
    mockFetchOnce({ status: 200, body: null, bodyText: "<html>oops" });
    const r = await operatorLoginStep1({ email: "a@b.com", password: "p" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_INVALID_RESPONSE");
  });
});

describe("operatorLoginStep2", () => {
  it("posts to /api/v1/operator/login/mfa with totp", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: {
          jwt: "j",
          expires_at: "2026-05-08T12:00:00.000Z",
          operator: { id: "o1", email: "a@b.com" },
        },
        error: null,
      },
    });
    const r = await operatorLoginStep2({
      mfaSessionToken: "tok",
      totp: "123456",
    });
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/operator/login/mfa`);
    expect(JSON.parse(init.body)).toEqual({
      mfa_session_token: "tok",
      totp: "123456",
    });
  });

  it("posts with recovery_code when totp absent", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: {
          jwt: "j",
          expires_at: "2026-05-08T12:00:00.000Z",
          operator: { id: "o1", email: "a@b.com" },
        },
        error: null,
      },
    });
    await operatorLoginStep2({ mfaSessionToken: "tok", recoveryCode: "abc-def" });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({
      mfa_session_token: "tok",
      recovery_code: "abc-def",
    });
  });
});

describe("operatorLogout", () => {
  it("posts with Authorization Bearer", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { revoked: true }, error: null },
    });
    const r = await operatorLogout("jwt-value");
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/operator/logout`);
    expect(init.headers["Authorization"]).toBe("Bearer jwt-value");
  });

  it("does not include body for logout", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: {}, error: null },
    });
    await operatorLogout("j");
    const [, init] = fetchMock.mock.calls[0];
    expect(init.body).toBeUndefined();
  });
});
