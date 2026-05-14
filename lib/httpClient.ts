// Shared HTTP client for ICONIA-SERVER REST calls (P1 §5.2 #34).
//
// 이전: lib/adminApi.ts:158-220, lib/auditApi.ts:31-69, lib/api/rag.ts:49-116 의
// `authedRequest` 함수가 3곳에 거의 동일한 내용으로 인라인 복사되어 있었다.
// 본 모듈은 그 단일 구현 — 헤더 정책 / envelope unwrap / error mapping 통일.
//
// 시그니처 호환: 기존 호출자는 `authedRequest<T>(args)` 만 호출하므로 그대로
// re-export 만 갈아끼우면 된다. 헤더 정책은 superset (Idempotency-Key / X-Request-Id
// 가 선택적으로 추가됨; 기본 호출에는 영향 없음).
//
// 본 모듈은 server-side 전용 (RSC / Server Action). 브라우저 직접 호출 없음 —
// credentials:'include' / NEXT_PUBLIC_* 없음. fetch 는 Node fetch 또는 vitest mock.

import { loadEnv } from "./env";
import type { ServerEnvelope, ServerResult } from "./types";

export type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

export type AuthedRequestArgs = {
  jwt: string;
  path: string;
  method: HttpMethod;
  body?: Record<string, unknown>;
  /**
   * Optional headers — 호출자가 mutating endpoint 에 idempotency 보장이나
   * request 추적 ID 를 첨부할 때 사용. 빈 값/undefined 는 무시 (header 미설정).
   */
  idempotencyKey?: string;
  requestId?: string;
};

/**
 * 표준 server-side fetch — Bearer JWT + JSON envelope unwrap + error mapping.
 *
 * 반환 규약:
 *   - 200~399 + envelope.ok === true  → `{ ok: true, data }`
 *   - 200~499 + envelope.ok === false → `{ ok: false, code, message, status, details? }`
 *   - 500+                            → `{ ok: false, code: ERR_SERVER_UNAVAILABLE, ... }`
 *   - fetch throw                     → `{ ok: false, code: ERR_NETWORK, status: 0 }`
 *   - 비-JSON body                    → `{ ok: false, code: ERR_INVALID_RESPONSE, ... }`
 *
 * never throws.
 */
export async function authedRequest<T>(
  args: AuthedRequestArgs,
): Promise<ServerResult<T>> {
  const env = loadEnv();
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${args.jwt}`,
  };
  if (args.body !== undefined) headers["Content-Type"] = "application/json";
  if (args.idempotencyKey) headers["Idempotency-Key"] = args.idempotencyKey;
  if (args.requestId) headers["X-Request-Id"] = args.requestId;

  let response: Response;
  try {
    response = await fetch(`${env.ICONIA_SERVER_URL}${args.path}`, {
      method: args.method,
      headers,
      body: args.body === undefined ? undefined : JSON.stringify(args.body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: "ERR_NETWORK", message: "network_error", status: 0 };
  }

  let envelope: ServerEnvelope<T>;
  try {
    envelope = (await response.json()) as ServerEnvelope<T>;
  } catch {
    return {
      ok: false,
      code: "ERR_INVALID_RESPONSE",
      message: "invalid_response",
      status: response.status,
    };
  }

  if (response.status >= 500) {
    return {
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "server_unavailable",
      status: response.status,
    };
  }

  if (envelope?.ok === true) return { ok: true, data: envelope.data };
  if (envelope?.ok === false && envelope.error) {
    return {
      ok: false,
      code: envelope.error.code,
      message: envelope.error.message,
      status: response.status,
      details: envelope.error.details,
    };
  }
  return {
    ok: false,
    code: "ERR_INVALID_RESPONSE",
    message: "invalid_response",
    status: response.status,
  };
}
