import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { authedRequest } from "./httpClient";

const BASE = "https://api.example.com";

beforeEach(() => {
  process.env.ICONIA_SERVER_URL = BASE;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(input: { status: number; body: unknown; bodyText?: string }) {
  const body = input.bodyText ?? JSON.stringify(input.body);
  // mockImplementation (not mockResolvedValue) so each retry attempt gets a fresh
  // Response instance — Response.body is a one-time readable stream and a single
  // instance would throw on the 2nd .json() call (retry path).
  const fetchMock = vi.fn().mockImplementation(() =>
    Promise.resolve(
      new Response(body, {
        status: input.status,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("authedRequest (shared httpClient)", () => {
  it("GET success: returns unwrapped envelope data", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { hello: "world" }, error: null },
    });
    const r = await authedRequest<{ hello: string }>({
      jwt: "j",
      path: "/api/v1/x",
      method: "GET",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.hello).toBe("world");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/x`);
    expect(init.method).toBe("GET");
    expect(init.headers["Authorization"]).toBe("Bearer j");
    expect(init.headers["Accept"]).toBe("application/json");
    expect(init.headers["Content-Type"]).toBeUndefined();
    expect(init.cache).toBe("no-store");
  });

  it("POST with body: sets Content-Type and serializes JSON", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await authedRequest({
      jwt: "j",
      path: "/api/v1/do",
      method: "POST",
      body: { foo: 1 },
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ foo: 1 });
  });

  it("attaches Idempotency-Key + X-Request-Id when provided", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await authedRequest({
      jwt: "j",
      path: "/api/v1/do",
      method: "POST",
      body: {},
      idempotencyKey: "idem-123",
      requestId: "req-abc",
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Idempotency-Key"]).toBe("idem-123");
    expect(init.headers["X-Request-Id"]).toBe("req-abc");
  });

  it("does not attach optional headers when undefined", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await authedRequest({ jwt: "j", path: "/api/v1/x", method: "GET" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers["Idempotency-Key"]).toBeUndefined();
    expect(init.headers["X-Request-Id"]).toBeUndefined();
  });

  it("envelope error → ServerErr with code/message/status", async () => {
    mockFetchOnce({
      status: 403,
      body: { ok: false, data: null, error: { code: "ERR_FOO", message: "denied" } },
    });
    const r = await authedRequest({ jwt: "j", path: "/api/v1/x", method: "GET" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_FOO");
      expect(r.message).toBe("denied");
      expect(r.status).toBe(403);
    }
  });

  it("5xx without structured error maps to ERR_SERVER_UNAVAILABLE", async () => {
    // 2026-06-22 — httpClient.ts:110-126 의 5xx 정책: envelope.error.code 가 있으면 통과,
    //   없으면 ERR_SERVER_UNAVAILABLE 폴백. 본 테스트는 폴백 경로를 검증.
    mockFetchOnce({
      status: 502,
      body: { ok: false, data: null }, // error 객체 미동봉 → fallback 경로.
    });
    const r = await authedRequest({ jwt: "j", path: "/api/v1/x", method: "GET" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
      expect(r.status).toBe(502);
    }
  });

  it("fetch throw maps to ERR_NETWORK status 0", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("dns fail"));
    vi.stubGlobal("fetch", fetchMock);
    const r = await authedRequest({ jwt: "j", path: "/api/v1/x", method: "GET" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_NETWORK");
      expect(r.status).toBe(0);
    }
  });

  it("non-JSON body maps to ERR_INVALID_RESPONSE", async () => {
    mockFetchOnce({ status: 200, body: null, bodyText: "<html>boom" });
    const r = await authedRequest({ jwt: "j", path: "/api/v1/x", method: "GET" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_INVALID_RESPONSE");
  });

  it("aborts a hanging request after timeoutMs and maps to ERR_NETWORK", async () => {
    // fetch 가 abort signal 을 받으면 AbortError 로 reject 하는 hang 모킹.
    const fetchMock = vi.fn(
      (_url: string, init: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => {
            const e = new Error("aborted");
            e.name = "AbortError";
            reject(e);
          });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const r = await authedRequest({
      jwt: "j",
      path: "/api/v1/slow",
      method: "GET",
      timeoutMs: 20,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_NETWORK");
      expect(r.message).toBe("request_timeout");
      expect(r.status).toBe(0);
    }
  });

  it("passes an AbortSignal to fetch by default", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await authedRequest({ jwt: "j", path: "/api/v1/x", method: "GET" });
    const [, init] = fetchMock.mock.calls[0];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
