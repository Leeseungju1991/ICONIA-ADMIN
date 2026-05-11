"use server";

// Knowledge Console — Server Actions (RSC + Server Actions 패턴, NO browser→Server fetch).
// 클라이언트 패널(ChunksPanel/QueryPanel)이 useTransition 으로 호출한다.
// 각 액션은 readSession() 으로 세션 JWT 를 읽어 lib/api/rag.ts 의 서버측 클라이언트에 넘긴다
// (lib/actions/devices.ts 등 기존 서버 액션 모듈과 동일 패턴).
// ServerResult<T> 는 평범한 discriminated union → 직렬화 가능 → 그대로 클라이언트에 반환.

import { readSession } from "@/lib/authCookie";
import { getRagChunks, ragTestQuery, type RagChunk, type RagQueryData } from "@/lib/api/rag";
import type { ServerResult } from "@/lib/types";

const AUTH_REQUIRED = {
  ok: false as const,
  code: "ERR_AUTH_REQUIRED",
  message: "세션이 만료되었습니다",
  status: 401,
};

export async function getChunksAction(
  sourceId: string,
  limit = 20,
): Promise<ServerResult<RagChunk[]>> {
  const jwt = readSession();
  if (!jwt) return AUTH_REQUIRED;
  return getRagChunks({ jwt, sourceId, limit });
}

export async function testQueryAction(input: {
  question: string;
  backendOverride?: "mock" | "bedrock";
  topK?: number;
}): Promise<ServerResult<RagQueryData>> {
  const jwt = readSession();
  if (!jwt) return AUTH_REQUIRED;
  return ragTestQuery({
    jwt,
    question: input.question,
    backendOverride: input.backendOverride,
    topK: input.topK,
  });
}
