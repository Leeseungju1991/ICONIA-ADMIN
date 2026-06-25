// ICONIA-ADMIN → ICONIA-SERVER RAG client.
// 서버 측 전용 모듈: RSC / Server Action 에서 호출한다 (lib/adminApi.ts 와 동일 패턴).
// 브라우저에서 직접 호출하지 않는다 — credentials:'include' / 'use client' / NEXT_PUBLIC_* 없음.
// Server 는 ICONIA envelope({ ok, data, error, meta }) 로 응답 → 여기서 unwrap 해 ServerResult<T> 반환 (throw 안 함).
// 필드명은 snake_case (서버 계약 그대로). camelCase 로 변환하지 않는다.
// Server 의 admin RAG 라우트는 Bearer JWT(requireOperator)로 gating 되며, 호출자(RSC/Server Action)가
// await readSession() 으로 세션 JWT 를 읽어 jwt 인자로 넘긴다 (adminApi.ts 의 함수들과 동일).

import { authedRequest } from "../httpClient";
import type { ServerResult } from "../types";

// ---------------------------------------------------------------------------
// Types — snake_case, 서버 계약 그대로.
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Low-level authed request — lib/httpClient.ts 의 공유 구현 사용 (P1 §5.2 #34).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// RAG admin surface — GET /api/v1/admin/rag/* (Task 16/17 서버 라우트).
// ---------------------------------------------------------------------------

export function listRagSources(args: {
  jwt: string;
}): Promise<ServerResult<RagSource[]>> {
  return authedRequest<RagSource[]>({
    jwt: args.jwt,
    path: `/api/v1/admin/rag/sources`,
    method: "GET",
  });
}

export function getRagChunks(args: {
  jwt: string;
  sourceId: string;
  limit?: number;
}): Promise<ServerResult<RagChunk[]>> {
  const limit = args.limit ?? 20;
  return authedRequest<RagChunk[]>({
    jwt: args.jwt,
    path: `/api/v1/admin/rag/sources/${encodeURIComponent(args.sourceId)}/chunks?limit=${limit}`,
    method: "GET",
  });
}

export function ragTestQuery(args: {
  jwt: string;
  question: string;
  backendOverride?: "mock" | "bedrock";
  topK?: number;
}): Promise<ServerResult<RagQueryData>> {
  const body: Record<string, unknown> = { question: args.question };
  if (args.backendOverride !== undefined) body.backend_override = args.backendOverride;
  if (args.topK !== undefined) body.top_k = args.topK;
  return authedRequest<RagQueryData>({
    jwt: args.jwt,
    path: `/api/v1/admin/rag/test-query`,
    method: "POST",
    body,
  });
}
