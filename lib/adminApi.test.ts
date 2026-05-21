import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  searchUsers,
  getUserDetail,
  forceLogoutUser,
  pauseDeployment,
  resumeDeployment,
  listDevices,
  listOrders,
  listWebhookEvents,
  listPosts,
  getOperatorMe,
  getAiHealth,
} from "./adminApi";

const BASE = "https://api.example.com";

beforeEach(() => {
  process.env.ICONIA_SERVER_URL = BASE;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(input: { status: number; body: unknown }) {
  const body = JSON.stringify(input.body);
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(body, {
      status: input.status,
      headers: { "Content-Type": "application/json" },
    }),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("searchUsers", () => {
  it("calls GET /api/v1/admin/users with email + limit query + Bearer", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { users: [{ id: "u1", email: "alice@example.com" }], total: 1 },
        error: null,
      },
    });
    const r = await searchUsers({ jwt: "j", email: "alic", limit: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.users[0].email).toBe("alice@example.com");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/users?email=alic&limit=10`);
    expect(init.method).toBe("GET");
    expect(init.headers["Authorization"]).toBe("Bearer j");
  });

  it("encodes email values safely (e.g. + and @)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { users: [], total: 0 }, error: null },
    });
    await searchUsers({ jwt: "j", email: "a+b@example.com" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("email=a%2Bb%40example.com");
  });

  it("omits limit when not provided", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { users: [], total: 0 }, error: null },
    });
    await searchUsers({ jwt: "j", email: "x" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/users?email=x`);
  });

  it("propagates server error", async () => {
    mockFetchOnce({
      status: 401,
      body: { ok: false, data: null, error: { code: "ERR_OPERATOR_AUTH_EXPIRED", message: "x" } },
    });
    const r = await searchUsers({ jwt: "j", email: "x" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_OPERATOR_AUTH_EXPIRED");
  });
});

describe("getUserDetail", () => {
  it("calls GET /api/v1/admin/users/:id with Bearer", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: {
          user: { id: "u1", email: "a@b.com", account_status: "active", totp_enabled: false },
          active_session_count: 0,
        },
        error: null,
      },
    });
    const r = await getUserDetail({ jwt: "j", userId: "u1" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.user.email).toBe("a@b.com");
      expect(r.data.active_session_count).toBe(0);
    }
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/users/u1`);
  });

  it("propagates 404 ERR_USER_NOT_FOUND", async () => {
    mockFetchOnce({
      status: 404,
      body: { ok: false, data: null, error: { code: "ERR_USER_NOT_FOUND", message: "x" } },
    });
    const r = await getUserDetail({ jwt: "j", userId: "u1" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_USER_NOT_FOUND");
  });
});

describe("forceLogoutUser", () => {
  it("POSTs to /:id/force-logout with Bearer + empty body", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { revoked_count: 2 }, error: null },
    });
    const r = await forceLogoutUser({ jwt: "j", userId: "u1" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.revoked_count).toBe(2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/users/u1/force-logout`);
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer j");
    expect(JSON.parse(init.body)).toEqual({});
  });

  it("forwards reason in body when provided (server may record in audit)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { revoked_count: 1 }, error: null },
    });
    await forceLogoutUser({ jwt: "j", userId: "u1", reason: "policy violation" });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ reason: "policy violation" });
  });
});

// pause/resume — Server 의 actual endpoint 는 단수형 (firmwareDeploymentRoutes.js:136~).
// pause 는 abort 와 별도 endpoint — state="holding" 으로만 전환하고 deployment 는 보존.
// 이전 라운드에서 admin client 가 abort 로 우회 호출하던 버그를 정정 (V1.0 #5).
describe("pauseDeployment", () => {
  it("POSTs to /api/admin/firmware/deployment/:id/pause (별도 endpoint)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await pauseDeployment({ jwt: "j", deploymentId: "dep-1", reason: "manual" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/admin/firmware/deployment/dep-1/pause`);
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer j");
    expect(JSON.parse(init.body)).toEqual({ reason: "manual" });
  });

  it("encodes deployment id safely", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await pauseDeployment({ jwt: "j", deploymentId: "a/b c" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/admin/firmware/deployment/a%2Fb%20c/pause`);
  });

  it("does NOT call /abort — pause must be distinct from abort", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await pauseDeployment({ jwt: "j", deploymentId: "dep-1" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain("/abort");
    expect(url).not.toContain("/api/v1/admin/firmware/deployments/");
  });
});

// Cursor/limit contract — list endpoints follow the same envelope shape
// `{ items, next_cursor }` (admin/commerce) or `{ items, next_cursor, since }`
// (audit-log). 본 라운드는 cursor/limit 파라미터 직렬화 + envelope unwrap 회귀
// 방지 차원.
describe("list-endpoint paging contract", () => {
  it("listDevices forwards cursor + limit + status + q on /api/v1/admin/devices", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { items: [], next_cursor: "next" }, error: null },
    });
    const r = await listDevices({
      jwt: "j",
      query: "ICN",
      status: "active",
      cursor: "c0",
      limit: 25,
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.next_cursor).toBe("next");
    const [url] = fetchMock.mock.calls[0];
    expect(String(url).startsWith(`${BASE}/api/v1/admin/devices?`)).toBe(true);
    expect(String(url)).toContain("q=ICN");
    expect(String(url)).toContain("status=active");
    expect(String(url)).toContain("cursor=c0");
    expect(String(url)).toContain("limit=25");
  });

  it("listOrders excludes payment fields per admin scope (server projection trusted)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: {
          items: [
            {
              id: "o1",
              woo_id: 42,
              status: "completed",
              customer_email: "x@y.z",
              total_amount: "10000",
              currency: "KRW",
              item_count: 1,
              paid_at: "2026-05-18T00:00:00Z",
              completed_at: null,
              created_at: "2026-05-17T00:00:00Z",
            },
          ],
          next_cursor: null,
        },
        error: null,
      },
    });
    const r = await listOrders({ jwt: "j", cursor: "c", status: "completed", limit: 10 });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const row = r.data.items[0] as Record<string, unknown>;
      // 본 type 에서 payment_method/transaction_id 가 *존재하지 않아야* 함.
      expect(row).not.toHaveProperty("payment_method");
      expect(row).not.toHaveProperty("transaction_id");
    }
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/admin/commerce/orders");
    expect(String(url)).toContain("cursor=c");
    expect(String(url)).toContain("status=completed");
    expect(String(url)).toContain("limit=10");
  });

  it("listWebhookEvents forwards only_failures=1 when truthy, omits when falsy", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { items: [], next_cursor: null }, error: null },
    });
    await listWebhookEvents({ jwt: "j", onlyFailures: true });
    const [url1] = fetchMock.mock.calls[0];
    expect(String(url1)).toContain("only_failures=1");

    const fetchMock2 = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { items: [], next_cursor: null }, error: null },
    });
    await listWebhookEvents({ jwt: "j" });
    const [url2] = fetchMock2.mock.calls[0];
    expect(String(url2)).not.toContain("only_failures");
  });

  it("listPosts forwards filter + cursor + limit", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { items: [], next_cursor: null }, error: null },
    });
    await listPosts({ jwt: "j", filter: "reported", cursor: "c", limit: 5 });
    const [url] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/api/v1/admin/posts");
    expect(String(url)).toContain("filter=reported");
    expect(String(url)).toContain("cursor=c");
    expect(String(url)).toContain("limit=5");
  });
});

describe("resumeDeployment", () => {
  it("POSTs to legacy singular /api/admin/firmware/deployment/:id/resume", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await resumeDeployment({ jwt: "j", deploymentId: "dep-1", reason: "verified rollback" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/admin/firmware/deployment/dep-1/resume`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ reason: "verified rollback" });
  });

  it("omits reason from body when not provided", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await resumeDeployment({ jwt: "j", deploymentId: "dep-1" });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({});
  });

  it("does NOT call the v1 plural path (stub returns 501)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await resumeDeployment({ jwt: "j", deploymentId: "dep-1" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain("/api/v1/admin/firmware/deployments/");
  });
});

describe("getOperatorMe", () => {
  it("calls GET /api/v1/operator/me with Bearer JWT and unwraps id/email/role", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { id: "op-1", email: "owner@example.com", role: "superadmin" },
        error: null,
      },
    });
    const r = await getOperatorMe({ jwt: "jwt-xyz" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data).toEqual({ id: "op-1", email: "owner@example.com", role: "superadmin" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/operator/me`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer jwt-xyz");
  });

  it("surfaces a 401 as an unauthenticated error result", async () => {
    mockFetchOnce({
      status: 401,
      body: { ok: false, data: null, error: { code: "ERR_UNAUTHORIZED", message: "no" } },
    });
    const r = await getOperatorMe({ jwt: "bad" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_UNAUTHORIZED");
      expect(r.status).toBe(401);
    }
  });
});

describe("getAiHealth", () => {
  it("calls GET /api/v1/admin/ai-health and unwraps the aiHealthTracker snapshot", async () => {
    const snapshot = {
      window_ms: 300000,
      window_total: 80,
      fallback_count: 3,
      fallback_rate: 0.0375,
      fallback_breakdown: { timeout: 3 },
      error_count: 1,
      error_rate: 0.0125,
      latency_ms: { p50: 700, p95: 2100, p99: 2900, max: 4100 },
      prompt_tokens_total: 30000,
      completion_tokens_total: 12000,
      calls_last_minute: 14,
      by_model: [],
    };
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: snapshot, error: null },
    });
    const r = await getAiHealth({ jwt: "j" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.latency_ms.p95).toBe(2100);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/ai-health`);
    expect(init.method).toBe("GET");
  });

  it("maps a 5xx to ERR_SERVER_UNAVAILABLE so callers can degrade to mock", async () => {
    mockFetchOnce({ status: 503, body: { ok: false, data: null, error: null } });
    const r = await getAiHealth({ jwt: "j" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });
});
