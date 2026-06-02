"use client";

// 2026-06-02 — 강력액션(삭제 등) 전용 커스텀 컨펌 모달.
// 브라우저 native window.confirm 은 그대로 두고, 새 호출처에서는 이 모달을 사용.
// - 헤더: bg-red-600 + 흰색 텍스트 + 경고 아이콘
// - 본문: 무엇이 사라지는지 + 되돌릴 수 없음 안내
// - 버튼: 확인=bg-red-600 hover:bg-red-700 / 취소=outline

import { useEffect } from "react";
import type { ReactNode } from "react";

export function DangerConfirmDialog({
  open,
  title,
  description,
  detail,
  confirmLabel = "삭제",
  cancelLabel = "취소",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  detail?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Esc 로 닫기 — busy 중에는 무시.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, onCancel]);

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="danger-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onCancel();
      }}
    >
      <div className="w-full max-w-md rounded-2xl bg-white border-2 border-red-300 shadow-xl overflow-hidden">
        <header className="bg-red-600 text-white px-4 py-3 flex items-center gap-2">
          {/* 경고 아이콘 (TriangleAlert) — inline SVG, deps 없음. */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            className="shrink-0"
          >
            <path d="M12 9v4" />
            <path d="M10.363 3.591L1.985 18.005A1.85 1.85 0 0 0 3.582 20.79h16.836a1.85 1.85 0 0 0 1.597-2.786L13.637 3.591a1.85 1.85 0 0 0-3.274 0Z" />
            <path d="M12 17h.01" />
          </svg>
          <h3 id="danger-dialog-title" className="text-base font-bold tracking-tight">
            {title}
          </h3>
        </header>
        <div className="px-4 py-4 text-sm text-slate-700">
          {description ? <p className="mb-2">{description}</p> : null}
          {detail ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
              {detail}
            </div>
          ) : null}
          <p className="mt-3 text-xs text-slate-500">
            이 동작은 되돌릴 수 없습니다. 정말 진행하시려면 아래 &ldquo;{confirmLabel}&rdquo; 버튼을 누르세요.
          </p>
        </div>
        <footer className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 py-3 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 min-h-[44px]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="rounded-lg bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 min-h-[44px]"
          >
            {busy ? "처리 중..." : confirmLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}
