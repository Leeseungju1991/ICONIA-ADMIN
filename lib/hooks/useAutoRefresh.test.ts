import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAutoRefresh, formatLastRefreshed } from "./useAutoRefresh";

// fake timers + visibility 조작으로 hook 거동 검증.
beforeEach(() => {
  vi.useFakeTimers();
  // 기본은 visible.
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function setVisibility(v: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => v,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useAutoRefresh", () => {
  it("does nothing when enabled=false", () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useAutoRefresh(cb, 1000, false));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(cb).not.toHaveBeenCalled();
    expect(result.current.running).toBe(false);
    expect(result.current.lastRefreshedAt).toBeNull();
  });

  it("invokes callback on interval when enabled", async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoRefresh(cb, 1000, true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(cb).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("updates lastRefreshedAt after successful callback", async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useAutoRefresh(cb, 1000, true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.lastRefreshedAt).not.toBeNull();
    expect(result.current.consecutiveFailures).toBe(0);
  });

  it("pauses when page becomes hidden, resumes (with immediate tick) on visible", async () => {
    const cb = vi.fn().mockResolvedValue(undefined);
    renderHook(() => useAutoRefresh(cb, 1000, true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(cb).toHaveBeenCalledTimes(1);

    // hidden — interval 멈춤, 시간 흘러도 호출 없음.
    await act(async () => {
      setVisibility("hidden");
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(cb).toHaveBeenCalledTimes(1);

    // visible 복귀 — 즉시 1회 + interval 재개.
    await act(async () => {
      setVisibility("visible");
    });
    // 즉시 1회 호출 (await microtask flush)
    await act(async () => {
      await Promise.resolve();
    });
    expect(cb).toHaveBeenCalledTimes(2);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(cb).toHaveBeenCalledTimes(3);
  });

  it("counts consecutive failures when callback throws", async () => {
    const cb = vi.fn().mockRejectedValue(new Error("boom"));
    const onResult = vi.fn();
    const { result } = renderHook(() =>
      useAutoRefresh(cb, { intervalMs: 1000, enabled: true, onResult }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.consecutiveFailures).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.consecutiveFailures).toBe(2);
    expect(onResult).toHaveBeenCalledTimes(2);
    expect(onResult).toHaveBeenLastCalledWith(
      expect.objectContaining({ ok: false }),
    );
  });

  it("fires onMaxFailures once threshold reached", async () => {
    const cb = vi.fn().mockRejectedValue(new Error("boom"));
    const onMax = vi.fn();
    renderHook(() =>
      useAutoRefresh(cb, {
        intervalMs: 1000,
        enabled: true,
        maxFailures: 3,
        onMaxFailures: onMax,
      }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });
    expect(onMax).toHaveBeenCalledTimes(1);
  });

  it("resets failure counter after a successful tick", async () => {
    let shouldFail = true;
    const cb = vi.fn().mockImplementation(async () => {
      if (shouldFail) throw new Error("x");
    });
    const { result } = renderHook(() =>
      useAutoRefresh(cb, { intervalMs: 1000, enabled: true }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.consecutiveFailures).toBe(2);
    shouldFail = false;
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.consecutiveFailures).toBe(0);
    expect(result.current.lastRefreshedAt).not.toBeNull();
  });

  it("treats explicit false return as failure", async () => {
    const cb = vi.fn().mockResolvedValue(false);
    const { result } = renderHook(() =>
      useAutoRefresh(cb, { intervalMs: 1000, enabled: true }),
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(result.current.consecutiveFailures).toBe(1);
    expect(result.current.lastRefreshedAt).toBeNull();
  });

  it("uses latest callback on each tick (closure stays fresh)", async () => {
    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const { rerender } = renderHook(({ fn }) => useAutoRefresh(fn, 1000, true), {
      initialProps: { fn: cb1 as () => void },
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(cb1).toHaveBeenCalledTimes(1);
    rerender({ fn: cb2 as () => void });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(cb1).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  it("cleans up interval on unmount", async () => {
    const cb = vi.fn();
    const { unmount } = renderHook(() => useAutoRefresh(cb, 1000, true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(cb).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("transitioning enabled=false stops the interval", async () => {
    const cb = vi.fn();
    const { rerender } = renderHook(
      ({ on }: { on: boolean }) => useAutoRefresh(cb, 1000, on),
      { initialProps: { on: true } },
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(cb).toHaveBeenCalledTimes(1);
    rerender({ on: false });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5000);
    });
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

describe("formatLastRefreshed", () => {
  it("returns em-dash for null", () => {
    expect(formatLastRefreshed(null)).toBe("—");
  });

  it("formats ms epoch to HH:MM:SS (padded)", () => {
    const t = new Date(2026, 4, 28, 9, 5, 3).getTime();
    expect(formatLastRefreshed(t)).toBe("09:05:03");
  });
});
