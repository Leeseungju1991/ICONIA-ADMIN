// ICONIA-ADMIN → ICONIA-SERVER RAG client.
// Admin은 항상 Server를 통해 호출한다 (AI 서비스 직접 호출 금지).
// Server는 ICONIA envelope({ ok, data, error, meta })로 응답 → 여기서 unwrap.
// 필드명은 snake_case (서버 계약 그대로). camelCase로 변환하지 않는다.
//
// 참고: lib/serverApi.ts / lib/adminApi.ts 의 기존 클라이언트는 Next 서버 측에서
// JWT bearer 로 Server 를 호출하고 ServerResult<T> 를 반환한다(throw 안 함).
// 이 모듈은 Knowledge Console(브라우저)에서 cookie 세션으로 직접 호출하고,
// 성공 시 data 를, 실패 시 throw 하는 계약이라 별도 helper 를 둔다.

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

export type RagSource = {
  id: string;
  title: string;
  chunks: number;
  updated_at: string;
};
export type RagChunk = {
  id: string;
  text: string;
  location?: { page?: number };
};
export type RagCitation = {
  source_id: string;
  text: string;
  score: number;
  location?: { page?: number; section?: string };
};
export type RagQueryData = {
  answer: string;
  citations: RagCitation[];
  backend: "mock" | "bedrock";
  latency_ms: number;
  truncated?: boolean;
  session_id?: string;
};

type Envelope<T> = {
  ok: boolean;
  data: T | null;
  error: { code: string; message: string; retryable?: boolean } | null;
  meta?: unknown;
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });

  let parsed: unknown = null;
  try {
    parsed = await res.json();
  } catch {
    /* non-JSON body; fall through to text handling below */
  }

  if (
    parsed &&
    typeof parsed === "object" &&
    "ok" in (parsed as Record<string, unknown>)
  ) {
    const env = parsed as Envelope<T>;
    if (!res.ok || env.ok === false) {
      const code = env.error?.code ?? "ERR_RAG_UPSTREAM";
      const msg = env.error?.message ?? `request failed (${res.status})`;
      throw new Error(`admin/rag ${path}: ${res.status} ${code} ${msg}`);
    }
    return env.data as T;
  }

  if (!res.ok) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      /* ignore */
    }
    throw new Error(`admin/rag ${path}: ${res.status} ${body}`);
  }

  return parsed as T;
}

export const ragApi = {
  listSources(): Promise<RagSource[]> {
    return request<RagSource[]>("/api/v1/admin/rag/sources");
  },
  getChunks(sourceId: string, limit = 20): Promise<RagChunk[]> {
    return request<RagChunk[]>(
      `/api/v1/admin/rag/sources/${encodeURIComponent(sourceId)}/chunks?limit=${limit}`,
    );
  },
  testQuery(input: {
    question: string;
    backendOverride?: "mock" | "bedrock";
    topK?: number;
  }): Promise<RagQueryData> {
    const body: Record<string, unknown> = { question: input.question };
    if (input.backendOverride !== undefined)
      body.backend_override = input.backendOverride;
    if (input.topK !== undefined) body.top_k = input.topK;
    return request<RagQueryData>("/api/v1/admin/rag/test-query", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
};
