"use client";

// useAutoRefresh — 페이지 polling hook (사용자/피드/커머스 화면에서 사용).
// (주)숨코리아 출시 정비 — APP → SERVER → ADMIN 흐름 실시간 확인용.
//
// 정책:
//   - 기본 10초 (조정 가능). enabled=false 면 완전 정지.
//   - 페이지 포커스 잃으면 자동 일시정지 (배터리/CPU 절약, visibilitychange).
//   - 페이지 포커스 복귀 → 즉시 1회 갱신 + interval 재개.
//   - 콜백이 throw (혹은 false 반환) 하면 연속 실패 카운터 증가.
//     3회 연속 실패 → onMaxFailures 콜백 + interval 정지 (호출자가 토글 OFF 결정).
//   - 매 성공마다 lastRefreshedAt 갱신 (UI 마지막 조회 시각 표시).

import { useCallback, useEffect, useRef, useState } from "react";

export type AutoRefreshState = {
  /** 마지막 성공 갱신 시각 (ms epoch). 없으면 null. */
  lastRefreshedAt: number | null;
  /** 연속 실패 횟수 (성공 시 0 으로 리셋). */
  consecutiveFailures: number;
  /** interval 활성 여부 (visibility 로 일시정지된 동안은 false). */
  running: boolean;
};

export type UseAutoRefreshOptions = {
  /** 갱신 주기 (ms). 기본 10000. */
  intervalMs?: number;
  /** false 면 완전 정지 (interval / listener 모두 해제). */
  enabled?: boolean;
  /** 최대 연속 실패 횟수 (도달 시 onMaxFailures 호출). 기본 3. */
  maxFailures?: number;
  /** 매 갱신 시도 결과 (성공/실패) 콜백. UI 토스트용. */
  onResult?: (result: { ok: boolean; error?: unknown }) => void;
  /** 연속 실패가 maxFailures 도달 시 1회 호출 (호출자가 토글 OFF 결정). */
  onMaxFailures?: () => void;
};

/**
 * polling 콜백을 주기적으로 실행.
 * `callback` 은 async 또는 sync 모두 지원. throw 또는 명시적 false 반환 시 실패로 카운트.
 * 콜백은 매 invocation 마다 최신 클로저로 호출됨 (ref 로 holding 하여 effect 재실행 방지).
 */
export function useAutoRefresh(
  callback: () => void | boolean | Promise<void | boolean>,
  intervalMsOrOptions?: number | UseAutoRefreshOptions,
  enabledArg?: boolean,
): AutoRefreshState {
  // 호출 형태 둘 다 지원:
  //   useAutoRefresh(cb, 10000, enabled)
  //   useAutoRefresh(cb, { intervalMs, enabled, onResult, onMaxFailures })
  let intervalMs = 10000;
  let enabled = true;
  let maxFailures = 3;
  let onResult: UseAutoRefreshOptions["onResult"];
  let onMaxFailures: UseAutoRefreshOptions["onMaxFailures"];
  if (typeof intervalMsOrOptions === "number") {
    intervalMs = intervalMsOrOptions;
    if (typeof enabledArg === "boolean") enabled = enabledArg;
  } else if (intervalMsOrOptions && typeof intervalMsOrOptions === "object") {
    if (typeof intervalMsOrOptions.intervalMs === "number") {
      intervalMs = intervalMsOrOptions.intervalMs;
    }
    if (typeof intervalMsOrOptions.enabled === "boolean") {
      enabled = intervalMsOrOptions.enabled;
    }
    if (typeof intervalMsOrOptions.maxFailures === "number") {
      maxFailures = intervalMsOrOptions.maxFailures;
    }
    onResult = intervalMsOrOptions.onResult;
    onMaxFailures = intervalMsOrOptions.onMaxFailures;
  }

  // 항상 최신 콜백을 ref 로 hold — interval re-create 방지.
  const cbRef = useRef(callback);
  cbRef.current = callback;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;
  const onMaxFailRef = useRef(onMaxFailures);
  onMaxFailRef.current = onMaxFailures;

  const failuresRef = useRef(0);
  const [state, setState] = useState<AutoRefreshState>({
    lastRefreshedAt: null,
    consecutiveFailures: 0,
    running: false,
  });

  const tick = useCallback(async () => {
    try {
      const ret = await cbRef.current();
      if (ret === false) {
        failuresRef.current += 1;
        setState((s) => ({ ...s, consecutiveFailures: failuresRef.current }));
        onResultRef.current?.({ ok: false });
        if (failuresRef.current >= maxFailures) {
          onMaxFailRef.current?.();
        }
        return;
      }
      failuresRef.current = 0;
      setState((s) => ({
        ...s,
        lastRefreshedAt: Date.now(),
        consecutiveFailures: 0,
      }));
      onResultRef.current?.({ ok: true });
    } catch (err) {
      failuresRef.current += 1;
      setState((s) => ({ ...s, consecutiveFailures: failuresRef.current }));
      onResultRef.current?.({ ok: false, error: err });
      if (failuresRef.current >= maxFailures) {
        onMaxFailRef.current?.();
      }
    }
  }, [maxFailures]);

  useEffect(() => {
    if (!enabled) {
      failuresRef.current = 0;
      setState((s) => ({ ...s, running: false, consecutiveFailures: 0 }));
      return;
    }

    let intervalId: ReturnType<typeof setInterval> | null = null;

    const isVisible = () =>
      typeof document === "undefined" || document.visibilityState !== "hidden";

    function start() {
      if (intervalId !== null) return;
      intervalId = setInterval(() => {
        // visibility-aware: hidden 동안은 tick skip (interval 자체는 살림).
        if (isVisible()) {
          void tick();
        }
      }, intervalMs);
      setState((s) => ({ ...s, running: true }));
    }

    function stop() {
      if (intervalId !== null) {
        clearInterval(intervalId);
        intervalId = null;
      }
      setState((s) => ({ ...s, running: false }));
    }

    function onVisibility() {
      if (typeof document === "undefined") return;
      if (document.visibilityState === "hidden") {
        stop();
      } else {
        // 복귀: 즉시 1회 + interval 재개.
        void tick();
        start();
      }
    }

    if (isVisible()) {
      start();
    }
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVisibility);
    }

    return () => {
      stop();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [enabled, intervalMs, tick]);

  return state;
}

/** "HH:MM:SS" — 마지막 조회 표시용. ms epoch 입력. */
export function formatLastRefreshed(ms: number | null): string {
  if (ms == null) return "—";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
