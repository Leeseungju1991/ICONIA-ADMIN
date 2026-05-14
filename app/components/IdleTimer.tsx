"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { idleLogoutAction } from "@/lib/actions/idleLogout";

// IdleTimer — 운영자 idle 자동 로그아웃 (감사 §5.2 #31 / SOC2 CC6.1).
//
// 동작:
//   - mouse / keyboard / touch / scroll / visibility 이벤트로 lastActivity 갱신.
//   - timeoutMs - WARNING_LEAD_MS 시점에 경고 다이얼로그 표시.
//   - 경고 다이얼로그에서 "계속 사용" 클릭 → 타이머 리셋.
//   - 경고를 무시하고 timeoutMs 도달 → idleLogoutAction 호출 → /login?reason=idle.
//
// 주의:
//   - tab visibilitychange "hidden" 동안에는 timer 가 일시정지하지 않음
//     (보안 정책: 자리 비움 = idle 로 간주).
//   - storage event 로 multi-tab 활동 동기화 — 한 탭에서 활동하면 모든 탭 reset.
//   - cookie 만료 / network 끊김 등은 catch 하지 않음 (logoutAction 이 best-effort).

const ACTIVITY_EVENTS = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
  "wheel",
] as const;

// 경고 다이얼로그를 띄우는 lead time (ms). 5분 전.
const WARNING_LEAD_MS = 5 * 60 * 1000;

// 활동 이벤트 throttle (ms) — mousemove 가 너무 자주 발생하면 setState 폭주 방지.
// 1초 throttle: 사용자 체감엔 영향 없고 reset 정확도 충분.
const ACTIVITY_THROTTLE_MS = 1000;

// LocalStorage key — 멀티탭 동기화용.
const STORAGE_KEY = "iconia_admin_last_activity_ms";

export function IdleTimer({ timeoutMinutes }: { timeoutMinutes: number }) {
  const timeoutMs = Math.max(60_000, timeoutMinutes * 60 * 1000);
  // 경고 lead time 이 timeout 보다 크면 (e.g. 5분 timeout) 경고는 timeout 의 절반 시점에.
  const warningLeadMs = Math.min(WARNING_LEAD_MS, Math.floor(timeoutMs / 2));

  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(Math.floor(warningLeadMs / 1000));

  const lastActivityRef = useRef<number>(Date.now());
  const warnTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastBroadcastRef = useRef<number>(0);

  const clearTimers = useCallback(() => {
    if (warnTimerRef.current) {
      clearTimeout(warnTimerRef.current);
      warnTimerRef.current = null;
    }
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
      logoutTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  const triggerLogout = useCallback(() => {
    clearTimers();
    // idleLogoutAction 은 redirect 까지 처리.
    // network 실패 / cookie 이미 만료 등은 무시 (server side 가 best-effort).
    void idleLogoutAction();
  }, [clearTimers]);

  const scheduleTimers = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    setSecondsLeft(Math.floor(warningLeadMs / 1000));

    const warnAfter = Math.max(0, timeoutMs - warningLeadMs);
    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true);
      // countdown
      const countdownStart = Date.now();
      countdownRef.current = setInterval(() => {
        const elapsed = Date.now() - countdownStart;
        const remaining = Math.max(0, warningLeadMs - elapsed);
        setSecondsLeft(Math.ceil(remaining / 1000));
        if (remaining <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      }, 1000);
      // 최종 로그아웃 타이머
      logoutTimerRef.current = setTimeout(triggerLogout, warningLeadMs);
    }, warnAfter);
  }, [clearTimers, timeoutMs, warningLeadMs, triggerLogout]);

  const resetActivity = useCallback(
    (broadcast: boolean) => {
      const now = Date.now();
      // throttle: 1초 미만 간격은 무시.
      if (now - lastActivityRef.current < ACTIVITY_THROTTLE_MS && !showWarning) {
        return;
      }
      lastActivityRef.current = now;
      scheduleTimers();
      if (broadcast && now - lastBroadcastRef.current > ACTIVITY_THROTTLE_MS) {
        lastBroadcastRef.current = now;
        try {
          window.localStorage.setItem(STORAGE_KEY, String(now));
        } catch {
          // SSR / private mode / quota — 무시
        }
      }
    },
    [scheduleTimers, showWarning],
  );

  // 초기 마운트 + 이벤트 리스너 설정.
  useEffect(() => {
    scheduleTimers();

    const onActivity = () => resetActivity(true);
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    // visibility 가 visible 로 돌아올 때 — 자리 비웠다가 돌아온 경우 lastActivity 검사.
    // hidden 동안 timeout 초과했으면 즉시 로그아웃.
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= timeoutMs) {
          triggerLogout();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // multi-tab 동기화 — 다른 탭이 활동했으면 lastActivity 만 업데이트.
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      const ts = Number.parseInt(e.newValue, 10);
      if (Number.isFinite(ts) && ts > lastActivityRef.current) {
        lastActivityRef.current = ts;
        scheduleTimers();
      }
    };
    window.addEventListener("storage", onStorage);

    return () => {
      clearTimers();
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("storage", onStorage);
    };
    // intentionally exclude resetActivity to keep listener identity stable —
    // resetActivity captures showWarning, but we close over the latest
    // scheduleTimers via closure here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs]);

  const onContinue = useCallback(() => {
    resetActivity(true);
  }, [resetActivity]);

  if (!showWarning) {
    return null;
  }

  const minutes = Math.floor(secondsLeft / 60);
  const seconds = secondsLeft % 60;
  const display =
    minutes > 0
      ? `${minutes}분 ${seconds.toString().padStart(2, "0")}초`
      : `${seconds}초`;

  // 다이얼로그 — 기존 .card / .btn 스타일 재사용. role="alertdialog" 로 a11y.
  return (
    <div
      className="idle-overlay"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-desc"
      data-testid="idle-warning"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        className="card"
        style={{ maxWidth: 400, width: "90%", padding: 24 }}
      >
        <h2 id="idle-title" style={{ marginTop: 0 }}>
          자동 로그아웃 안내
        </h2>
        <p id="idle-desc">
          장시간 입력이 없어 곧 자동 로그아웃됩니다.
          <br />
          <strong data-testid="idle-countdown">{display}</strong> 후 로그아웃됩니다.
        </p>
        <form action={idleLogoutAction} style={{ display: "inline-block", marginRight: 8 }}>
          <button type="submit" className="btn small secondary">
            지금 로그아웃
          </button>
        </form>
        <button
          type="button"
          className="btn small"
          onClick={onContinue}
          data-testid="idle-continue"
        >
          계속 사용
        </button>
      </div>
    </div>
  );
}
