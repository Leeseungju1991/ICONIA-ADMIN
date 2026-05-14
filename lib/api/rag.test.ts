import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  listRagSources,
  getRagChunks,
  ragTestQuery,
  type RagSource,
  type RagChunk,
  type RagQueryData,
} from "./rag";

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

describe("rag server-side client", () => {
  it("listRagSources: GET /api/v1/admin/rag/sources with Bearer jwt + no-store → ServerResult.ok with data array", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: [
          { id: "manual", title: "제품 매뉴얼", chunks: 3, updated_at: "2026-01-01T00:00:00.000Z" },
        ] satisfies RagSource[],
        error: null,
      },
    });
    const res = await listRagSources({ jwt: "j" });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data[0].id).toBe("manual");
      expect(res.data[0].updated_at).toBe("2026-01-01T00:00:00.000Z");
    }
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe(`${BASE}/api/v1/admin/rag/sources`);
    expect(init.method).toBe("GET");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer j");
    expect(init.cache).toBe("no-store");
  });

  it("getRagChunks: GET .../sources/:id/chunks?limit=N, url-encodes id, Bearer jwt", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: [{ id: "manual#0", text: "본문" }] satisfies RagChunk[], error: null },
    });
    const res = await getRagChunks({ jwt: "j", sourceId: "manual v1", limit: 5 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data[0].id).toBe("manual#0");
    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe(`${BASE}/api/v1/admin/rag/sources/manual%20v1/chunks?limit=5`);
  });

  it("getRagChunks: default limit 20", async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: { ok: true, data: [], error: null } });
    await getRagChunks({ jwt: "j", sourceId: "manual" });
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/limit=20$/);
  });

  it("ragTestQuery: POST .../test-query with snake_case body, Bearer jwt → ServerResult.ok with data", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: {
        ok: true,
        data: {
          answer: "답변",
          citations: [{ source_id: "manual#0", text: "본문", score: 0.9 }],
          backend: "mock",
          latency_ms: 12,
        } satisfies RagQueryData,
        error: null,
      },
    });
    const res = await ragTestQuery({ jwt: "j", question: "보증?", backendOverride: "bedrock", topK: 3 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.answer).toBe("답변");
      expect(res.data.latency_ms).toBe(12);
      expect(res.data.citations[0].source_id).toBe("manual#0");
    }
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(String(url)).toBe(`${BASE}/api/v1/admin/rag/test-query`);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe("Bearer j");
    const body = JSON.parse(init.body as string);
    expect(body.question).toBe("보증?");
    expect(body.backend_override).toBe("bedrock");
    expect(body.top_k).toBe(3);
  });

  it("ragTestQuery: omits backend_override / top_k when not provided", async () => {
    const fetchMock = mockFetchOnce({
      status: 200,
      body: { ok: true, data: { answer: "a", citations: [], backend: "mock", latency_ms: 1 }, error: null },
    });
    await ragTestQuery({ jwt: "j", question: "q" });
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect("backend_override" in body).toBe(false);
    expect("top_k" in body).toBe(false);
  });

  it("returns ServerResult.ok=false on ok:false envelope (carries code/message/status)", async () => {
    mockFetchOnce({
      status: 400,
      body: { ok: false, data: null, error: { code: "ERR_RAG_VALIDATION", message: "bad" } },
    });
    const res = await ragTestQuery({ jwt: "j", question: "q" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("ERR_RAG_VALIDATION");
      expect(res.message).toBe("bad");
      expect(res.status).toBe(400);
    }
  });

  it("returns ServerResult.ok=false on non-2xx with non-JSON body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
      text: async () => "plain error",
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);
    const res = await listRagSources({ jwt: "j" });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("ERR_INVALID_RESPONSE");
  });

  it("does not send credentials:'include' (server-side module, not browser)", async () => {
    const fetchMock = mockFetchOnce({ status: 200, body: { ok: true, data: [], error: null } });
    await listRagSources({ jwt: "j" });
    expect((fetchMock.mock.calls[0][1] as RequestInit).credentials).toBeUndefined();
  });
});
