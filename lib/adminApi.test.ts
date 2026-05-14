import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  searchUsers,
  getUserDetail,
  forceLogoutUser,
  pauseDeployment,
  resumeDeployment,
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

// pause/resume — Server 의 actual endpoint 는 legacy 단수형 (P0 §5.1.10c).
// 본 테스트는 admin client 가 항상 actual path 로 호출함을 강제한다 — drift 회귀 방지.
describe("pauseDeployment", () => {
  it("POSTs to legacy singular /api/admin/firmware/deployment/:id/abort", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await pauseDeployment({ jwt: "j", deploymentId: "dep-1", reason: "manual" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/admin/firmware/deployment/dep-1/abort`);
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
    expect(url).toBe(`${BASE}/api/admin/firmware/deployment/a%2Fb%20c/abort`);
  });

  it("does NOT call the v1 plural path (stub returns 501)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { ok: true }, error: null },
    });
    await pauseDeployment({ jwt: "j", deploymentId: "dep-1" });
    const [url] = fetchMock.mock.calls[0];
    expect(url).not.toContain("/api/v1/admin/firmware/deployments/");
    expect(url).not.toContain("/pause");
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
