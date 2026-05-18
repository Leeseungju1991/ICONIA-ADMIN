"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";
import { idleLogoutAction } from "@/lib/actions/idleLogout";

// IdleTimer — 운영자 idle 자동 로그아웃 (감사 §5.2 #31 / SOC2 CC6.1).
//
// MUI Dialog 로 재스킨 (UI만). 기존 timer/activity/multi-tab 로직 보존.
// data-testid 들은 Dialog 의 PaperProps 와 DialogContent 내부에 매핑 — 테스트 호환.
//
// 동작:
//   - mouse / keyboard / touch / scroll / visibility 이벤트로 lastActivity 갱신.
//   - timeoutMs - WARNING_LEAD_MS 시점에 경고 다이얼로그 표시.
//   - 경고 다이얼로그에서 "계속 사용" 클릭 → 타이머 리셋.
//   - 경고를 무시하고 timeoutMs 도달 → idleLogoutAction 호출 → /login?reason=idle.

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

// 활동 이벤트 throttle (ms).
const ACTIVITY_THROTTLE_MS = 1000;

// LocalStorage key — 멀티탭 동기화용.
const STORAGE_KEY = "iconia_admin_last_activity_ms";

export function IdleTimer({ timeoutMinutes }: { timeoutMinutes: number }) {
  const timeoutMs = Math.max(60_000, timeoutMinutes * 60 * 1000);
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
    void idleLogoutAction();
  }, [clearTimers]);

  const scheduleTimers = useCallback(() => {
    clearTimers();
    setShowWarning(false);
    setSecondsLeft(Math.floor(warningLeadMs / 1000));

    const warnAfter = Math.max(0, timeoutMs - warningLeadMs);
    warnTimerRef.current = setTimeout(() => {
      setShowWarning(true);
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
      logoutTimerRef.current = setTimeout(triggerLogout, warningLeadMs);
    }, warnAfter);
  }, [clearTimers, timeoutMs, warningLeadMs, triggerLogout]);

  const resetActivity = useCallback(
    (broadcast: boolean) => {
      const now = Date.now();
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

  useEffect(() => {
    scheduleTimers();

    const onActivity = () => resetActivity(true);
    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, onActivity, { passive: true });
    }

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= timeoutMs) {
          triggerLogout();
        }
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

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

  // PaperProps 에 data-testid="idle-warning" — 테스트가 getByTestId 로 접근.
  return (
    <Dialog
      open
      aria-labelledby="idle-title"
      aria-describedby="idle-desc"
      role="alertdialog"
      maxWidth="xs"
      fullWidth
      PaperProps={{ "data-testid": "idle-warning" } as Record<string, unknown>}
    >
      <DialogTitle id="idle-title">자동 로그아웃 안내</DialogTitle>
      <DialogContent>
        <Typography id="idle-desc" variant="body2" sx={{ mb: 1 }}>
          장시간 입력이 없어 곧 자동 로그아웃됩니다.
        </Typography>
        <Typography variant="body1">
          <strong data-testid="idle-countdown">{display}</strong> 후 로그아웃됩니다.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
        <Box component="form" action={idleLogoutAction} sx={{ display: "inline-block" }}>
          <Button type="submit" variant="outlined" size="small" color="inherit">
            지금 로그아웃
          </Button>
        </Box>
        <Button
          type="button"
          variant="contained"
          size="small"
          onClick={onContinue}
          data-testid="idle-continue"
        >
          계속 사용
        </Button>
      </DialogActions>
    </Dialog>
  );
}
