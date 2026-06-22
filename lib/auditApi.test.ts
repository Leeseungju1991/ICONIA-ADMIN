import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { appendAuditLog, listAuditLog } from "./auditApi";

const BASE = "https://api.example.com";

beforeEach(() => {
  process.env.ICONIA_SERVER_URL = BASE;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockFetchOnce(input: { status: number; body: unknown; bodyText?: string }) {
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

describe("listAuditLog", () => {
  it("GETs /api/v1/admin/audit-log with Bearer and no query when no filters", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: { items: [], next_cursor: null, since: "2026-05-01T00:00:00.000Z" },
        error: null,
      },
    });
    const r = await listAuditLog({ jwt: "j" });
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${BASE}/api/v1/admin/audit-log`);
    expect(init.method).toBe("GET");
    expect(init.headers["Authorization"]).toBe("Bearer j");
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("builds the query string from filters", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { items: [], next_cursor: null, since: "x" }, error: null },
    });
    await listAuditLog({
      jwt: "j",
      action: "operator.login",
      operatorId: "o1",
      targetType: "user",
      since: "2026-05-01T00:00:00.000Z",
      cursor: "c1",
      limit: 50,
    });
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("action=operator.login");
    expect(url).toContain("operator_id=o1");
    expect(url).toContain("target_resource_type=user");
    expect(url).toContain("since=2026-05-01");
    expect(url).toContain("cursor=c1");
    expect(url).toContain("limit=50");
  });

  it("returns the hash-chain fields on each entry", async () => {
    mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: {
          items: [
            {
              id: "a1",
              sequence_no: 1,
              action: "operator.login",
              user_id: null,
              operator_id: "o1",
              operator_role: "superadmin",
              target_resource_type: null,
              target_resource_id: null,
              action_outcome: "success",
              ip: "10.0.0.1",
              user_agent: "ua",
              metadata: {},
              created_at: "2026-05-01T00:00:00.000Z",
              request_id: "r1",
              prev_hash: null,
              current_hash: "deadbeef",
            },
          ],
          next_cursor: "c2",
          since: "2026-05-01T00:00:00.000Z",
        },
        error: null,
      },
    });
    const r = await listAuditLog({ jwt: "j" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.items[0].current_hash).toBe("deadbeef");
      expect(r.data.items[0].prev_hash).toBeNull();
      expect(r.data.items[0].sequence_no).toBe(1);
      expect(r.data.next_cursor).toBe("c2");
    }
  });

  it("maps 403 RBAC denial to the error envelope code", async () => {
    mockFetchOnce({
      status: 403,
      body: { ok: false, data: null, error: { code: "ERR_OPERATOR_FORBIDDEN", message: "role not allowed" } },
    });
    const r = await listAuditLog({ jwt: "j" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_OPERATOR_FORBIDDEN");
      expect(r.status).toBe(403);
    }
  });

  it("maps 5xx (unstructured) to ERR_SERVER_UNAVAILABLE", async () => {
    // 2026-06-22 — httpClient 5xx 정책: 구조화 에러 envelope 가 있으면 통과, 없으면 폴백.
    mockFetchOnce({
      status: 502,
      body: { ok: false, data: null }, // error 객체 미동봉 → fallback 경로.
    });
    const r = await listAuditLog({ jwt: "j" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });

  it("maps fetch throw to ERR_NETWORK", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("dns fail"));
    vi.stubGlobal("fetch", fetchMock);
    const r = await listAuditLog({ jwt: "j" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_NETWORK");
      expect(r.status).toBe(0);
    }
  });

  it("maps non-JSON body to ERR_INVALID_RESPONSE", async () => {
    mockFetchOnce({ status: 200, body: null, bodyText: "<html>gateway timeout" });
    const r = await listAuditLog({ jwt: "j" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_INVALID_RESPONSE");
  });
});

// canonical operator-audit append contract — Server `/api/v1/admin/audit-log` POST.
// Server-side recordOperatorAuditAction action 이 사용하는 단일 진입점.
describe("appendAuditLog", () => {
  it("POSTs to /api/v1/admin/audit-log with snake_case body and Bearer JWT", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { id: "ent_1" }, error: null },
    });
    const r = await appendAuditLog({
      jwt: "j",
      input: {
        action: "user.force_logout",
        targetUserId: "u1",
        targetResourceType: "user",
        targetResourceId: "u1",
        payloadHash: "deadbeef",
        reasonText: "policy violation",
      },
    });
    expect(r.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${BASE}/api/v1/admin/audit-log`);
    expect(init.method).toBe("POST");
    expect(init.headers["Authorization"]).toBe("Bearer j");
    expect(init.headers["Content-Type"]).toBe("application/json");
    // 본문은 snake_case (서버 계약). request_id 는 client 가 자동 발급 (UUID v4).
    const sent = JSON.parse(init.body);
    expect(sent.request_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    delete sent.request_id;
    expect(sent).toEqual({
      action: "user.force_logout",
      target_user_id: "u1",
      target_resource_type: "user",
      target_resource_id: "u1",
      payload_hash: "deadbeef",
      reason_text: "policy violation",
    });
  });

  it("uses explicit requestId when caller provides one (멱등 재시도 케이스)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { id: "ent_3" }, error: null },
    });
    await appendAuditLog({
      jwt: "j",
      input: { action: "user.force_logout", targetUserId: "u1" },
      requestId: "11111111-1111-4111-8111-111111111111",
    });
    const [, init] = fetchMock.mock.calls[0];
    expect(JSON.parse(init.body).request_id).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("omits optional fields when not provided (request_id 는 자동 발급)", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { id: "ent_2" }, error: null },
    });
    await appendAuditLog({
      jwt: "j",
      input: { action: "user.pii_unmasked" },
    });
    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse(init.body);
    expect(body.action).toBe("user.pii_unmasked");
    expect(typeof body.request_id).toBe("string");
    expect(body).not.toHaveProperty("target_user_id");
    expect(body).not.toHaveProperty("payload_hash");
  });

  it("propagates 403 ERR_OPERATOR_FORBIDDEN as ServerErr", async () => {
    mockFetchOnce({
      status: 403,
      body: { ok: false, data: null, error: { code: "ERR_OPERATOR_FORBIDDEN", message: "x" } },
    });
    const r = await appendAuditLog({
      jwt: "j",
      input: { action: "user.force_logout", targetUserId: "u1" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_OPERATOR_FORBIDDEN");
      expect(r.status).toBe(403);
    }
  });

  it("propagates 5xx (unstructured) via shared httpClient mapping (ERR_SERVER_UNAVAILABLE)", async () => {
    // 2026-06-22 — 구조화 미동봉 5xx 만 ERR_SERVER_UNAVAILABLE 로 폴백 (httpClient 정책).
    mockFetchOnce({
      status: 503,
      body: { ok: false, data: null },
    });
    const r = await appendAuditLog({ jwt: "j", input: { action: "user.force_logout" } });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });
});
