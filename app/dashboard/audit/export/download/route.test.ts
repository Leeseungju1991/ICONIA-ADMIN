import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";

const cookieStore = {
  set: vi.fn(),
  delete: vi.fn(),
  get: vi.fn(),
};

vi.mock("next/headers", () => ({
  cookies: () => cookieStore,
}));

import { GET } from "./route";

const BASE = "https://api.example.com";

beforeEach(() => {
  cookieStore.get.mockReset();
  process.env.ICONIA_SERVER_URL = BASE;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function authedRequest(url: string): NextRequest {
  cookieStore.get.mockReturnValue({ value: "operator-jwt" });
  return new NextRequest(new URL(url));
}

function mockListAuditOnce(items: unknown[], nextCursor: string | null = null) {
  const fetchMock = vi.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        ok: true,
        data: {
          items,
          next_cursor: nextCursor,
          since: "2026-05-01T00:00:00.000Z",
        },
        error: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "a1",
    sequence_no: 1,
    action: "operator.login",
    user_id: null,
    operator_id: "op-1",
    operator_role: "secops",
    target_resource_type: null,
    target_resource_id: null,
    action_outcome: "success",
    ip: "10.0.0.1",
    user_agent: "ua",
    metadata: {},
    created_at: "2026-05-13T10:00:00.000Z",
    request_id: "r1",
    prev_hash: null,
    current_hash: "deadbeef",
    ...overrides,
  };
}

describe("GET /dashboard/audit/export/download", () => {
  it("401 when no session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const req = new NextRequest(
      new URL("https://admin.example.com/dashboard/audit/export/download?since=2026-05-01T00:00"),
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it("400 when since is missing", async () => {
    const req = authedRequest("https://admin.example.com/dashboard/audit/export/download");
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it("returns CSV with header row + escaped fields", async () => {
    mockListAuditOnce([
      sampleRow({ action: 'a,b\n"c"' }),
      sampleRow({ id: "a2", sequence_no: 2, action: "device_unpaired" }),
    ]);
    const req = authedRequest(
      "https://admin.example.com/dashboard/audit/export/download?since=2026-05-01T00:00",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    expect(res.headers.get("Content-Disposition")).toMatch(/attachment; filename="audit-log-/);
    expect(res.headers.get("X-Row-Count")).toBe("2");
    expect(res.headers.get("X-Truncated")).toBe("0");

    const body = await res.text();
    const lines = body.split("\r\n").filter((l) => l.length > 0);
    expect(lines[0]).toContain("sequence_no,id,action,");
    // 첫 row 의 action 은 quoted (comma + newline + quote 포함).
    expect(lines[1]).toContain('"a,b\n""c""",');
    // 두 번째 row 의 action 은 그대로.
    expect(lines[2]).toContain(",device_unpaired,");
  });

  it("propagates server error envelope", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            ok: false,
            data: null,
            error: { code: "ERR_OPERATOR_FORBIDDEN", message: "role" },
          }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        ),
      ),
    );
    const req = authedRequest(
      "https://admin.example.com/dashboard/audit/export/download?since=2026-05-01T00:00",
    );
    const res = await GET(req);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("ERR_OPERATOR_FORBIDDEN");
  });

  it("respects until cutoff via client-side filter", async () => {
    mockListAuditOnce([
      sampleRow({ id: "a1", created_at: "2026-05-13T10:00:00.000Z" }),
      sampleRow({ id: "a2", created_at: "2026-05-14T10:00:00.000Z" }),
    ]);
    const req = authedRequest(
      "https://admin.example.com/dashboard/audit/export/download?since=2026-05-01T00:00&until=2026-05-13T23:59",
    );
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("X-Row-Count")).toBe("1");
    const body = await res.text();
    expect(body).toContain("a1");
    expect(body).not.toContain("a2,");
  });
});
