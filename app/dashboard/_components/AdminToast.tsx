"use client";
// AdminToast — ADMIN 전용 통일 토스트 컴포넌트.
//
// 규격:
//   · tone 4종: success / warning / error / info (기본)
//   · 자동 dismiss: 단문(≤30자) 2.5s / 중문(31-80자) 4s / 액션·에러 6s
//   · 위치: fixed bottom-6 right-6 z-50, max-w-sm
//   · 색상: 성공=emerald / 경고=amber / 에러=rose / 정보=slate-900
//   · 닫기 버튼 + 자동 dismiss 공존
//
// 사용:
//   const { toast, setToast } = useAdminToast();
//   setToast({ message: '저장됨', tone: 'success' });
//   setToast({ message: '처리 실패', tone: 'error' });
//   // 단순 문자열도 허용 (info 톤):
//   setToast('저장됨');
//
// 렌더:
//   return <div>...{children}...<AdminToast toast={toast} onDismiss={() => setToast(null)} /></div>

import { useEffect, useRef, useState } from "react";

export type ToastTone = "success" | "warning" | "error" | "info";

export interface ToastMessage {
  message: string;
  tone?: ToastTone;
}

export type ToastInput = string | ToastMessage | null;

interface AdminToastProps {
  toast: ToastInput;
  onDismiss: () => void;
}

/** 문자 수 기준 자동 dismiss 시간(ms). */
function autoMs(message: string, tone: ToastTone): number {
  // 에러는 항상 6s — 사용자가 내용을 읽어야 하므로.
  if (tone === "error") return 6000;
  const len = message.length;
  if (len <= 30) return 2500;
  if (len <= 80) return 4000;
  return 6000;
}

const TONE_STYLES: Record<ToastTone, { bg: string; text: string; border: string; dot: string }> = {
  success: {
    bg: "bg-emerald-900/90",
    text: "text-white",
    border: "border-emerald-700/60",
    dot: "bg-emerald-400",
  },
  warning: {
    bg: "bg-amber-900/90",
    text: "text-white",
    border: "border-amber-700/60",
    dot: "bg-amber-400",
  },
  error: {
    bg: "bg-rose-900/90",
    text: "text-white",
    border: "border-rose-700/60",
    dot: "bg-rose-400",
  },
  info: {
    bg: "bg-slate-900/85",
    text: "text-white",
    border: "border-slate-700/60",
    dot: "bg-slate-400",
  },
};

export function AdminToast({ toast, onDismiss }: AdminToastProps) {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const msg = toast == null ? null : typeof toast === "string" ? toast : toast.message;
  const tone: ToastTone =
    toast == null
      ? "info"
      : typeof toast === "string"
        ? "info"
        : (toast.tone ?? "info");

  useEffect(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (msg == null) {
      setVisible(false);
      return;
    }
    setVisible(true);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, autoMs(msg, tone));
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg, tone]);

  if (!visible || msg == null) return null;

  const s = TONE_STYLES[tone];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed bottom-6 right-6 z-50 flex items-start gap-2.5 rounded-2xl border px-4 py-3 shadow-card max-w-sm text-sm
        ${s.bg} ${s.text} ${s.border}`}
    >
      {/* 톤 표시 dot */}
      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} aria-hidden />
      <span className="flex-1 leading-snug">{msg}</span>
      <button
        type="button"
        className="ml-1 shrink-0 underline opacity-75 hover:opacity-100 transition-opacity"
        onClick={() => {
          setVisible(false);
          onDismiss();
        }}
        aria-label="알림 닫기"
      >
        닫기
      </button>
    </div>
  );
}

/**
 * AdminToast 를 사용하는 페이지에서 쓰는 로컬 훅.
 * toast state 와 setToast setter 를 반환한다.
 *
 * 사용 예:
 *   const { toast, setToast } = useAdminToast();
 *   setToast('저장됨');
 *   setToast({ message: '실패', tone: 'error' });
 *   setToast(null); // 수동 dismiss
 */
export function useAdminToast() {
  const [toast, setToast] = useState<ToastInput>(null);
  return { toast, setToast };
}
