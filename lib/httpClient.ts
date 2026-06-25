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

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

// 양산화 — Server 응답 hang 으로부터 관리자 패널 보호.
//   Server 가 멈추거나 네트워크가 끊긴 채 소켓이 살아 있으면 fetch 는 무한 대기한다.
//   대량 트래픽 상황에서 이런 hang 한 건이 RSC 렌더를 통째로 멈출 수 있으므로,
//   AbortController 로 상한선을 두어 timeout 을 ERR_NETWORK 로 graceful 매핑한다.
const DEFAULT_TIMEOUT_MS = 10_000;

// ─── Retry 정책 ──────────────────────────────────────────────────────────────
// 5xx / 429: retry (최대 3회, exponential backoff 200ms base, cap 2s)
// 4xx (429 제외): no retry — 클라이언트 측 오류이므로 즉시 final.
const RETRY_MAX_ATTEMPTS = 3; // 최초 시도 포함 총 횟수 (= 최초 1 + 재시도 2)
const RETRY_BASE_MS = 200;
const RETRY_CAP_MS = 2_000;

/** `Retry-After` 헤더 파싱 → 대기 ms. 초(단위) 또는 HTTP-date 형식 지원. */
function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  // 숫자 (초 단위)
  const secs = Number(header.trim());
  if (!Number.isNaN(secs) && secs >= 0) return Math.min(secs * 1_000, 60_000);
  // HTTP-date 형식
  const at = Date.parse(header);
  if (!Number.isNaN(at)) {
    const delta = at - Date.now();
    return delta > 0 ? Math.min(delta, 60_000) : 0;
  }
  return null;
}

/** 주어진 ms 를 Promise 로 대기. 테스트에서 주입 가능. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── In-process Circuit Breaker ───────────────────────────────────────────────
// 슬라이딩 윈도우 30s / 연속 5xx 임계값 5 / 쿨다운 30s
// 인스턴스 1개 (모듈 스코프) — 서버 프로세스 전체 공유. 의존성 추가 없음.
const BREAKER_WINDOW_MS = 30_000;
const BREAKER_THRESHOLD = 5; // 연속 5xx 횟수
const BREAKER_COOLDOWN_MS = 30_000;

type BreakerState = "closed" | "open";

const breaker: {
  state: BreakerState;
  consecutiveFails: number;
  openedAt: number | null;
  // 슬라이딩 윈도우: 5xx 발생 타임스탬프 배열 (오래된 것은 trimWindow 에서 제거)
  failTimestamps: number[];
} = {
  state: "closed",
  consecutiveFails: 0,
  openedAt: null,
  failTimestamps: [],
};

/** 윈도우 밖 타임스탬프 정리 */
function trimWindow(): void {
  const cutoff = Date.now() - BREAKER_WINDOW_MS;
  while (breaker.failTimestamps.length > 0 && breaker.failTimestamps[0] < cutoff) {
    breaker.failTimestamps.shift();
  }
}

/** 5xx 발생 시 브레이커 알림 */
function breakerRecordFailure(): void {
  const now = Date.now();
  breaker.failTimestamps.push(now);
  trimWindow();
  breaker.consecutiveFails += 1;
  if (breaker.consecutiveFails >= BREAKER_THRESHOLD) {
    breaker.state = "open";
    breaker.openedAt = now;
  }
}

/** 성공 시 브레이커 초기화 */
function breakerRecordSuccess(): void {
  breaker.consecutiveFails = 0;
  breaker.failTimestamps = [];
  if (breaker.state === "open") {
    breaker.state = "closed";
    breaker.openedAt = null;
  }
}

/**
 * 브레이커가 open 상태인지 확인. 쿨다운 경과 시 half-open → closed 전환.
 * (Half-open 을 명시적 상태로 두지 않고 단순 시간 경과 후 closed 로 복귀)
 */
function isBreakerOpen(): boolean {
  if (breaker.state !== "open") return false;
  const elapsed = Date.now() - (breaker.openedAt ?? 0);
  if (elapsed >= BREAKER_COOLDOWN_MS) {
    // 쿨다운 만료 → 닫힘 복귀 (다음 요청이 실제 probe)
    breaker.state = "closed";
    breaker.consecutiveFails = 0;
    breaker.openedAt = null;
    return false;
  }
  return true;
}

// 사용자에게 노출할 한국어 에러 메시지
const MSG_SERVER_TRANSIENT =
  "서버에 일시적 문제가 발생했습니다. 잠시 후 다시 시도해주세요.";

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
  /** 요청 timeout (ms). 미지정 시 10,000ms. 0 이하면 timeout 비활성. */
  timeoutMs?: number;
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
 * 추가 동작 (req#4/#5):
 *   - 5xx / 429: 최대 3회(재시도 2회) 지수 backoff (200ms base, 2s cap)
 *   - Retry-After 헤더 존재 시 그 값 우선
 *   - 4xx (429 제외): no retry
 *   - 연속 5xx 5회 → circuit breaker open → 쿨다운 30s (이후 자동 복귀)
 *   - breaker open / retries 소진 시 MSG_SERVER_TRANSIENT 한국어 메시지 포함
 *
 * never throws.
 */
export async function authedRequest<T>(
  args: AuthedRequestArgs,
): Promise<ServerResult<T>> {
  // ── 브레이커 확인 ────────────────────────────────────────────────────────
  if (isBreakerOpen()) {
    return {
      ok: false,
      code: "ERR_CIRCUIT_OPEN",
      message: MSG_SERVER_TRANSIENT,
      status: 0,
    };
  }

  const env = loadEnv();
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${args.jwt}`,
  };
  if (args.body !== undefined) headers["Content-Type"] = "application/json";
  if (args.idempotencyKey) headers["Idempotency-Key"] = args.idempotencyKey;
  if (args.requestId) headers["X-Request-Id"] = args.requestId;

  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // ── 단일 fetch 시도 (timeout 포함) ──────────────────────────────────────
  async function attemptFetch(): Promise<ServerResult<T> & { _retryAfterMs?: number }> {
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timer =
      controller != null
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;

    let response: Response;
    try {
      response = await fetch(`${env.ICONIA_SERVER_URL}${args.path}`, {
        method: args.method,
        headers,
        body: args.body === undefined ? undefined : JSON.stringify(args.body),
        cache: "no-store",
        signal: controller?.signal,
      });
    } catch (err) {
      const isTimeout = err instanceof Error && err.name === "AbortError";
      return {
        ok: false,
        code: "ERR_NETWORK",
        message: isTimeout ? "request_timeout" : "network_error",
        status: 0,
      };
    } finally {
      if (timer != null) clearTimeout(timer);
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

    // 5xx 처리
    if (response.status >= 500) {
      const retryAfterMs =
        parseRetryAfterMs(response.headers.get("Retry-After")) ?? undefined;

      if (envelope?.ok === false && envelope.error?.code) {
        return {
          ok: false,
          code: envelope.error.code,
          message: envelope.error.message,
          status: response.status,
          details: envelope.error.details,
          _retryAfterMs: retryAfterMs,
        };
      }
      return {
        ok: false,
        code: "ERR_SERVER_UNAVAILABLE",
        message: "server_unavailable",
        status: response.status,
        _retryAfterMs: retryAfterMs,
      };
    }

    // 429 Too Many Requests — retry 대상
    if (response.status === 429) {
      const retryAfterMs =
        parseRetryAfterMs(response.headers.get("Retry-After")) ?? undefined;
      return {
        ok: false,
        code: "ERR_RATE_LIMITED",
        message: "rate_limited",
        status: 429,
        _retryAfterMs: retryAfterMs,
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

  // ── Retry 루프 ───────────────────────────────────────────────────────────
  let lastResult: ServerResult<T> | null = null;

  for (let attempt = 1; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    const result = await attemptFetch();
    lastResult = result;

    const isRetryable =
      !result.ok &&
      (result.status >= 500 ||
        result.status === 429 ||
        result.code === "ERR_RATE_LIMITED" ||
        result.code === "ERR_SERVER_UNAVAILABLE");

    // 5xx → 브레이커에 알림
    if (!result.ok && result.status >= 500) {
      breakerRecordFailure();
    } else if (result.ok) {
      breakerRecordSuccess();
    }

    // 성공 혹은 retry 불가 (4xx 등)
    if (result.ok || !isRetryable) {
      return result;
    }

    // 브레이커가 방금 열렸으면 즉시 반환
    if (isBreakerOpen()) {
      return {
        ok: false,
        code: "ERR_CIRCUIT_OPEN",
        message: MSG_SERVER_TRANSIENT,
        status: 0,
      };
    }

    // 마지막 시도였으면 루프 종료 (재시도 없음)
    if (attempt >= RETRY_MAX_ATTEMPTS) break;

    // Retry-After 우선, 없으면 지수 backoff
    const retryAfterMs =
      (result as ServerResult<T> & { _retryAfterMs?: number })._retryAfterMs;
    const backoff = Math.min(
      RETRY_BASE_MS * Math.pow(2, attempt - 1),
      RETRY_CAP_MS,
    );
    const delayMs = retryAfterMs !== undefined ? retryAfterMs : backoff;
    await sleep(delayMs);
  }

  // 모든 재시도 소진 — 한국어 메시지로 교체
  if (lastResult !== null && !lastResult.ok) {
    return {
      ...lastResult,
      message: MSG_SERVER_TRANSIENT,
    };
  }

  // 이 경로는 정상적으로 도달하지 않음
  return {
    ok: false,
    code: "ERR_SERVER_UNAVAILABLE",
    message: MSG_SERVER_TRANSIENT,
    status: 0,
  };
}
