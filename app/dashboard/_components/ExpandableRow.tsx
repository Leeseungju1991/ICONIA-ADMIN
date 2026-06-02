"use client";

// 2026-06-02 — 공통 펼침 행 컴포넌트.
// error-tracking 페이지의 "스택/접기" 버튼 패턴을 추출 — 공지/푸시 등에서 재사용.
// summary = 상시 노출되는 요약 영역 (제목·작성자·상태 등 한 줄)
// detail  = 펼침 시 그 아래에 나타나는 본문 (제목·본문·이미지·통계 등)
// trailing = 우측 끝 보조 영역 (삭제 버튼 등, 펼침 버튼과 함께 노출됨)

import type { ReactNode } from "react";

export function ExpandableRow({
  expanded,
  onToggle,
  summary,
  detail,
  trailing,
  expandLabel = "펼침",
  collapseLabel = "접기",
}: {
  expanded: boolean;
  onToggle: () => void;
  summary: ReactNode;
  detail: ReactNode;
  trailing?: ReactNode;
  expandLabel?: string;
  collapseLabel?: string;
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0 flex-1 break-words">{summary}</div>
        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="rounded-lg bg-white border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50 min-h-[32px]"
          >
            {expanded ? collapseLabel : expandLabel}
          </button>
          {trailing}
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
          {detail}
        </div>
      ) : null}
    </li>
  );
}
