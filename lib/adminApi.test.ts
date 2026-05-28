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
  getSloSnapshot,
  getAlertConfig,
  updateAlertRule,
  searchLogs,
  closeCircuitBreaker,
  invalidateCache,
  setMaintenanceMode,
  createAdminUser,
  createAdminFeedPost,
  uploadAdminMedia,
  adminErrorMessageKo,
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

// ---------------------------------------------------------------------------
// V1.0 — 관측성 / SLO / 알람 / 로그 / 운영 제어 endpoints.
// ---------------------------------------------------------------------------

describe("getSloSnapshot", () => {
  it("calls GET /api/v1/admin/metrics/slo", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: {
          window_ms: 300_000,
          observed_at: "2026-05-27T00:00:00Z",
          overall: {
            calls: 100,
            p50: 12,
            p95: 80,
            p99: 200,
            error_rate: 0,
            client_error_rate: 0,
          },
          by_route: [],
          ai: {
            fallback_rate: 0,
            error_rate: 0,
            p95_latency_ms: 0,
            calls_last_minute: 0,
          },
          dependencies: [],
        },
        error: null,
      },
    });
    const r = await getSloSnapshot({ jwt: "j" });
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/metrics/slo`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer j");
  });

  it("maps ERR_NETWORK so unreachable Server gracefully degrades", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED")),
    );
    const r = await getSloSnapshot({ jwt: "j" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });
});

describe("getAlertConfig / updateAlertRule", () => {
  it("GET /api/v1/admin/alerts/config", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { rules: [], channels: [] }, error: null },
    });
    const r = await getAlertConfig({ jwt: "j" });
    expect(r.ok).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toBe(
      `${BASE}/api/v1/admin/alerts/config`,
    );
  });

  it("PATCH /api/v1/admin/alerts/config/:key with body", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: {
          key: "api.p95.global",
          label: "API p95",
          unit: "ms",
          threshold: 250,
          enabled: true,
          channels: ["slack"],
          note: null,
          updated_at: "2026-05-27T00:00:00Z",
        },
        error: null,
      },
    });
    const r = await updateAlertRule({
      jwt: "j",
      key: "api.p95.global",
      patch: { threshold: 250, enabled: true, channels: ["slack"] },
      reason: "p95 완화",
    });
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/alerts/config/api.p95.global`);
    expect(init.method).toBe("PATCH");
    const body = JSON.parse(init.body as string);
    expect(body.threshold).toBe(250);
    expect(body.enabled).toBe(true);
    expect(body.channels).toEqual(["slack"]);
    expect(body.reason).toBe("p95 완화");
  });
});

describe("searchLogs", () => {
  it("GET /api/v1/admin/logs/search with query params", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { items: [], next_cursor: null, approx_total: 0 },
        error: null,
      },
    });
    await searchLogs({
      jwt: "j",
      level: "error",
      route: "/api/v1/admin",
      status: "5xx",
      q: "timeout",
      limit: 50,
    });
    const [url] = fetchMock.mock.calls[0];
    const u = new URL(url as string);
    expect(u.pathname).toBe("/api/v1/admin/logs/search");
    expect(u.searchParams.get("level")).toBe("error");
    expect(u.searchParams.get("route")).toBe("/api/v1/admin");
    expect(u.searchParams.get("status")).toBe("5xx");
    expect(u.searchParams.get("q")).toBe("timeout");
    expect(u.searchParams.get("limit")).toBe("50");
  });
});

describe("ops controls", () => {
  it("closeCircuitBreaker POSTs to /circuit/:name/close", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { ok: true, name: "ai_service", state: "closed" },
        error: null,
      },
    });
    await closeCircuitBreaker({
      jwt: "j",
      name: "ai_service",
      reason: "AI 회복 후 강제 close",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/ops/circuit/ai_service/close`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.reason).toBe("AI 회복 후 강제 close");
  });

  it("invalidateCache POSTs to /cache/invalidate with selector", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { ok: true, selector: "all", cleared: 1 },
        error: null,
      },
    });
    await invalidateCache({
      jwt: "j",
      selector: "all",
      reason: "stale 키 일소",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/ops/cache/invalidate`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.selector).toBe("all");
  });

  it("setMaintenanceMode POSTs to /ops/maintenance with enabled+until", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { enabled: true, until: "2026-05-27T03:00:00Z" },
        error: null,
      },
    });
    await setMaintenanceMode({
      jwt: "j",
      enabled: true,
      until: "2026-05-27T03:00:00Z",
      reason: "DB 마이그레이션 10분",
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/ops/maintenance`);
    const body = JSON.parse(init.body as string);
    expect(body.enabled).toBe(true);
    expect(body.until).toBe("2026-05-27T03:00:00Z");
  });
});

describe("admin manual create — users / feed / media", () => {
  it("createAdminUser POSTs to /api/v1/admin/users with full body", async () => {
    const fetchMock = mockFetchOnce({
      status: 201,
      body: {
        ok: true,
        data: {
          user: {
            id: "u-uuid",
            email: "x@y.com",
            displayName: "Ada",
            role: "user",
            account_status: "active",
            created_at: "2026-05-27T00:00:00Z",
            is_verified: true,
          },
        },
        error: null,
      },
    });
    const r = await createAdminUser({
      jwt: "j",
      email: "x@y.com",
      password: "Strong#Pass1",
      displayName: "Ada",
      agreedTermsVersion: "1.0",
      ageVerified: true,
      autoVerified: true,
      reason: "영업 미팅 시연용",
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.user.email).toBe("x@y.com");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/users`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.email).toBe("x@y.com");
    expect(body.password).toBe("Strong#Pass1");
    expect(body.agreedTermsVersion).toBe("1.0");
    expect(body.ageVerified).toBe(true);
    expect(body.autoVerified).toBe(true);
    expect(body.role).toBe("user"); // default
    expect(body.reason).toBe("영업 미팅 시연용");
  });

  it("createAdminUser propagates ERR_USER_EMAIL_EXISTS", async () => {
    mockFetchOnce({
      status: 409,
      body: {
        ok: false,
        data: null,
        error: {
          code: "ERR_USER_EMAIL_EXISTS",
          message: "email_already_in_use",
        },
      },
    });
    const r = await createAdminUser({
      jwt: "j",
      email: "dup@y.com",
      password: "Strong#Pass1",
      agreedTermsVersion: "1.0",
      ageVerified: true,
      reason: "테스트 중복 케이스",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_USER_EMAIL_EXISTS");
      expect(r.status).toBe(409);
    }
  });

  it("createAdminFeedPost POSTs to /api/v1/admin/feed/posts with media array", async () => {
    const fetchMock = mockFetchOnce({
      status: 201,
      body: {
        ok: true,
        data: {
          post: {
            id: "p_1",
            author_id: "u_1",
            body: "안녕",
            comments_count: 0,
            is_hidden: false,
            created_at: "2026-05-27T00:00:00Z",
          },
          mediaCount: 1,
        },
        error: null,
      },
    });
    const r = await createAdminFeedPost({
      jwt: "j",
      authorId: "00000000-0000-0000-0000-000000000001",
      body: "안녕",
      media: [
        {
          url: "https://cdn.example.com/x.jpg",
          type: "image",
          width: 1080,
          height: 1920,
        },
      ],
      status: "published",
      reason: "운영팀 공지",
    });
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/feed/posts`);
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body as string);
    expect(body.authorId).toBe("00000000-0000-0000-0000-000000000001");
    expect(body.body).toBe("안녕");
    expect(body.media).toEqual([
      {
        url: "https://cdn.example.com/x.jpg",
        type: "image",
        width: 1080,
        height: 1920,
      },
    ]);
    expect(body.status).toBe("published");
    expect(body.reason).toBe("운영팀 공지");
  });

  it("createAdminFeedPost omits media when not provided", async () => {
    const fetchMock = mockFetchOnce({
      status: 201,
      body: {
        ok: true,
        data: {
          post: {
            id: "p_2",
            author_id: "u_1",
            body: "text only",
            comments_count: 0,
            is_hidden: false,
            created_at: "2026-05-27T00:00:00Z",
          },
          mediaCount: 0,
        },
        error: null,
      },
    });
    await createAdminFeedPost({
      jwt: "j",
      authorId: "00000000-0000-0000-0000-000000000001",
      body: "text only",
      reason: "텍스트 게시물",
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body as string);
    expect("media" in body).toBe(false);
    expect(body.status).toBe("published"); // default
  });

  it("uploadAdminMedia POSTs multipart to /api/v1/admin/media/upload with file field", async () => {
    const fetchMock = mockFetchOnce({
      status: 201,
      body: {
        ok: true,
        data: {
          url: "https://cdn.example.com/abc.jpg",
          mimeType: "image/jpeg",
          sizeBytes: 1234,
          width: 800,
          height: 600,
        },
        error: null,
      },
    });
    // Blob 으로 가벼운 jpeg 시뮬레이션. node 환경에서도 동작.
    const blob = new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: "image/jpeg" });
    const progressEvents: number[] = [];
    const r = await uploadAdminMedia({
      jwt: "j",
      file: blob,
      fileName: "x.jpg",
      baseUrl: BASE,
      onProgress: (p) => {
        progressEvents.push(p.ratio);
      },
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.url).toBe("https://cdn.example.com/abc.jpg");
      expect(r.data.mimeType).toBe("image/jpeg");
    }
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/media/upload`);
    expect(init.method).toBe("POST");
    // Authorization 헤더 검증 + Content-Type 은 자동 (fetch 가 boundary 포함 설정).
    expect(init.headers["Authorization"]).toBe("Bearer j");
    expect("Content-Type" in init.headers).toBe(false);
    expect(init.body).toBeInstanceOf(FormData);
    // onProgress 는 server-side 경로에서 (0, 1) 두 번 호출.
    expect(progressEvents[0]).toBe(0);
    expect(progressEvents[progressEvents.length - 1]).toBe(1);
  });

  it("uploadAdminMedia maps ERR_MEDIA_TOO_LARGE error envelope", async () => {
    mockFetchOnce({
      status: 413,
      body: {
        ok: false,
        data: null,
        error: { code: "ERR_MEDIA_TOO_LARGE", message: "too_large" },
      },
    });
    const blob = new Blob([new Uint8Array(10)], { type: "image/jpeg" });
    const r = await uploadAdminMedia({
      jwt: "j",
      file: blob,
      fileName: "big.jpg",
      baseUrl: BASE,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_MEDIA_TOO_LARGE");
      expect(r.status).toBe(413);
    }
  });

  it("adminErrorMessageKo maps known codes to Korean", () => {
    expect(adminErrorMessageKo("ERR_USER_EMAIL_EXISTS")).toBe(
      "이미 사용 중인 이메일입니다.",
    );
    expect(adminErrorMessageKo("ERR_TERMS_REQUIRED")).toContain("19세");
    expect(adminErrorMessageKo("ERR_MEDIA_TOO_LARGE")).toContain("용량");
    expect(adminErrorMessageKo(undefined)).toContain("알 수 없는");
    // 미정의 코드는 그대로 반환 (개발자 추적용).
    expect(adminErrorMessageKo("ERR_FOO_BAR_BAZ")).toBe("ERR_FOO_BAR_BAZ");
  });
});
