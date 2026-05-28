"use client";

// AutoRefreshToggle — 사용자/피드/커머스 페이지 우측 상단 공통 토글.
// (주)숨코리아 출시 정비 — APP 가입 → SERVER 적재 → ADMIN 표시 흐름 시각화.

import { formatLastRefreshed } from "@/lib/hooks/useAutoRefresh";

export function AutoRefreshToggle({
  enabled,
  onToggle,
  lastRefreshedAt,
  intervalSec = 10,
}: {
  enabled: boolean;
  onToggle: (next: boolean) => void;
  lastRefreshedAt: number | null;
  intervalSec?: number;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl bg-white/70 border border-slate-200 px-3 py-1.5 text-xs"
      data-testid="auto-refresh-toggle"
    >
      <span className="text-slate-600">
        마지막 조회{" "}
        <span className="font-mono text-slate-800" data-testid="auto-refresh-last">
          {formatLastRefreshed(lastRefreshedAt)}
        </span>
      </span>
      <span aria-hidden className="text-slate-300">
        |
      </span>
      <label className="inline-flex items-center gap-2 cursor-pointer select-none">
        <span className="text-slate-700">자동 갱신 ({intervalSec}s)</span>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label="자동 갱신 토글"
          onClick={() => onToggle(!enabled)}
          className={
            "relative inline-flex h-5 w-9 items-center rounded-full transition " +
            (enabled ? "bg-emerald-500" : "bg-slate-300")
          }
          data-testid="auto-refresh-switch"
          data-state={enabled ? "on" : "off"}
        >
          <span
            className={
              "inline-block h-4 w-4 transform rounded-full bg-white shadow transition " +
              (enabled ? "translate-x-4" : "translate-x-0.5")
            }
          />
        </button>
        <span
          className={
            "text-[11px] font-semibold " +
            (enabled ? "text-emerald-700" : "text-slate-500")
          }
        >
          {enabled ? "ON" : "OFF"}
        </span>
      </label>
    </div>
  );
}
