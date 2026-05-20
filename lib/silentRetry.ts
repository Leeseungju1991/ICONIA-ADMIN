// 운영자 액션의 *일시 실패*를 silent 하게 재시도하는 헬퍼.
//
// 정책 (ICONIA 공통 — Router → Admin 라운드 2, 2026-05-20):
//   - 운영자가 명시적으로 실행한 액션(예: OTA 재시도 큐 적재·푸시 재발송 큐 적재)은
//     네트워크/일시 장애로 1-2회 실패하더라도 *운영자에게 노출하지 않는다*. 자동 재시도.
//   - 최종 시도까지 실패해야 toast 등으로 명확히 노출.
//   - 시스템 에러 (예: 펌웨어 panic, 사용자 영향 에러) 는 본 헬퍼를 거치지 *않는다* —
//     항상 visible. 본 헬퍼는 *운영자 자기 액션* 한정.
//
// 본 모듈은 의도적으로 외부 의존성 0. fetch / setTimeout 만 사용.

export type SilentRetryOptions = {
  /** 총 시도 횟수 (최초 시도 포함). 기본 3. */
  maxAttempts?: number;
  /** 1차 backoff ms. 기본 250. 시도마다 *2 (지수). */
  baseDelayMs?: number;
  /** 지터 (0~1 사이) — 동시 retry 충돌 방지. 기본 0.2. */
  jitter?: number;
  /**
   * 예외/거부값을 transient 로 분류할지 결정. true → 재시도 / false → 즉시 throw.
   * 기본: 모든 thrown 값을 transient 로 간주.
   */
  isTransient?: (err: unknown) => boolean;
  /**
   * setTimeout 주입 — 테스트에서 fake timer 또는 즉시 호출용.
   * (typeof window === "undefined" 환경에서도 동작하도록.)
   */
  scheduler?: (cb: () => void, ms: number) => void;
};

export type SilentRetryResult<T> =
  | { ok: true; value: T; attempts: number }
  | { ok: false; error: unknown; attempts: number };

const defaultScheduler = (cb: () => void, ms: number): void => {
  setTimeout(cb, ms);
};

/**
 * `action` 을 최대 `maxAttempts` 회 시도. 일시 실패는 silent (콘솔에도 출력하지 않음).
 * 모든 시도 실패 시 마지막 error 와 함께 ok:false 로 resolve. throw 하지 않는다.
 */
export function runWithSilentRetry<T>(
  action: () => Promise<T> | T,
  options: SilentRetryOptions = {},
): Promise<SilentRetryResult<T>> {
  const {
    maxAttempts = 3,
    baseDelayMs = 250,
    jitter = 0.2,
    isTransient = () => true,
    scheduler = defaultScheduler,
  } = options;

  if (maxAttempts < 1) {
    return Promise.resolve({ ok: false, error: new Error("maxAttempts < 1"), attempts: 0 });
  }

  return new Promise<SilentRetryResult<T>>((resolve) => {
    let attempt = 0;

    const tryOnce = (): void => {
      attempt += 1;
      Promise.resolve()
        .then(() => action())
        .then(
          (value) => resolve({ ok: true, value, attempts: attempt }),
          (err: unknown) => {
            if (attempt >= maxAttempts || !isTransient(err)) {
              resolve({ ok: false, error: err, attempts: attempt });
              return;
            }
            // 지수 backoff with jitter — silent.
            const base = baseDelayMs * Math.pow(2, attempt - 1);
            const jitterRange = base * jitter;
            const delay = Math.max(
              0,
              base + (Math.random() * 2 - 1) * jitterRange,
            );
            scheduler(tryOnce, delay);
          },
        );
    };

    tryOnce();
  });
}

/**
 * 일시 실패 판정 휴리스틱 — 5xx · 네트워크 끊김 · timeout 만 transient.
 * 4xx · 권한 거부 · 카탈로그상 retryable=false 는 즉시 final.
 */
export function defaultIsTransient(err: unknown): boolean {
  if (!err) return false;
  if (typeof err === "object" && err !== null) {
    const e = err as { status?: number; code?: string; name?: string; message?: string };
    if (typeof e.status === "number") {
      // 5xx, 408 (request timeout), 429 (rate-limit) 는 transient.
      if (e.status >= 500 || e.status === 408 || e.status === 429) return true;
      // 4xx 는 final.
      if (e.status >= 400 && e.status < 500) return false;
    }
    if (e.name === "AbortError" || e.name === "TimeoutError") return true;
    if (e.code === "ECONNRESET" || e.code === "ETIMEDOUT" || e.code === "ENETUNREACH")
      return true;
    if (typeof e.message === "string" && /timeout|network/i.test(e.message)) return true;
  }
  return false;
}
