import { describe, it, expect } from "vitest";
import { defaultIsTransient, runWithSilentRetry } from "./silentRetry";

describe("silentRetry", () => {
  // 테스트 헬퍼 — 즉시 콜백 실행 scheduler (지연 무시).
  const immediate = (cb: () => void): void => {
    cb();
  };

  it("returns ok=true on first attempt success", async () => {
    const r = await runWithSilentRetry(async () => 42);
    expect(r).toEqual({ ok: true, value: 42, attempts: 1 });
  });

  it("retries on transient failure and eventually succeeds — silent", async () => {
    let calls = 0;
    const r = await runWithSilentRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("network timeout");
        return "ok";
      },
      { maxAttempts: 5, scheduler: immediate },
    );
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value).toBe("ok");
      expect(r.attempts).toBe(3);
    }
  });

  it("gives up after maxAttempts and returns ok=false with last error", async () => {
    const err = new Error("always fail");
    let calls = 0;
    const r = await runWithSilentRetry(
      async () => {
        calls += 1;
        throw err;
      },
      { maxAttempts: 3, scheduler: immediate },
    );
    expect(r.ok).toBe(false);
    expect(calls).toBe(3);
    if (!r.ok) {
      expect(r.error).toBe(err);
      expect(r.attempts).toBe(3);
    }
  });

  it("does NOT retry when isTransient returns false (final failure)", async () => {
    let calls = 0;
    const r = await runWithSilentRetry(
      async () => {
        calls += 1;
        throw { status: 403, message: "forbidden" };
      },
      { maxAttempts: 5, scheduler: immediate, isTransient: defaultIsTransient },
    );
    expect(calls).toBe(1);
    expect(r.ok).toBe(false);
  });

  it("retries 5xx errors with defaultIsTransient", async () => {
    let calls = 0;
    const r = await runWithSilentRetry(
      async () => {
        calls += 1;
        if (calls < 2) throw { status: 503 };
        return "back online";
      },
      { maxAttempts: 4, scheduler: immediate, isTransient: defaultIsTransient },
    );
    expect(r.ok).toBe(true);
    expect(calls).toBe(2);
  });

  it("retries 429 (rate-limit) which the catalog treats as transient", async () => {
    let calls = 0;
    const r = await runWithSilentRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw { status: 429 };
        return "ok";
      },
      { maxAttempts: 5, scheduler: immediate, isTransient: defaultIsTransient },
    );
    expect(r.ok).toBe(true);
    expect(calls).toBe(3);
  });

  it("does not throw — failures resolve to ok=false", async () => {
    const r = await runWithSilentRetry(
      () => {
        throw "string thrown value";
      },
      { maxAttempts: 1, scheduler: immediate },
    );
    expect(r.ok).toBe(false);
  });

  it("defaultIsTransient: 5xx + timeout + abort → true; 4xx + null → false", () => {
    expect(defaultIsTransient({ status: 500 })).toBe(true);
    expect(defaultIsTransient({ status: 502 })).toBe(true);
    expect(defaultIsTransient({ status: 408 })).toBe(true);
    expect(defaultIsTransient({ name: "AbortError" })).toBe(true);
    expect(defaultIsTransient({ name: "TimeoutError" })).toBe(true);
    expect(defaultIsTransient({ code: "ECONNRESET" })).toBe(true);
    expect(defaultIsTransient({ message: "request timeout" })).toBe(true);
    expect(defaultIsTransient({ status: 400 })).toBe(false);
    expect(defaultIsTransient({ status: 401 })).toBe(false);
    expect(defaultIsTransient(null)).toBe(false);
    expect(defaultIsTransient(undefined)).toBe(false);
  });
});
