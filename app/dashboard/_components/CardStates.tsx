// 2026-05-27 — 빈상태 / 로딩 / 에러 3종 표준화. 모든 신규 패널이 이 컴포넌트를
// 사용해 일관된 톤(Stitch slate-50/200 + accent loading)을 갖는다.

import type { ReactNode } from "react";

export function LoadingState({ label = "불러오는 중..." }: { label?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-6 text-center text-sm text-slate-500">
      <span className="spinner mr-2 align-middle" />
      {label}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
  icon,
}: {
  title: string;
  hint?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-8 text-center text-slate-500">
      {icon ? <div className="mx-auto mb-2 text-slate-300">{icon}</div> : null}
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {hint ? <div className="text-[11px] mt-1">{hint}</div> : null}
    </div>
  );
}

// 2026-05-27 — 사용자 요구: 조회 실패 / Server 미가동 텍스트 모두 노출 금지.
// 어떤 에러가 와도 silent empty state 로 통일.
export function ErrorState({
  message: _message,
  unreachable: _unreachable,
  onRetry,
}: {
  message?: string;
  unreachable?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-8 text-center text-slate-500">
      <div className="text-sm font-medium text-slate-700">데이터 없음</div>
      {onRetry ? (
        <button
          className="mt-2 rounded-lg bg-white border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
          type="button"
          onClick={onRetry}
        >
          다시 불러오기
        </button>
      ) : null}
    </div>
  );
}

export function FixtureBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-medium text-amber-700"
      title="Server 라우트 미가동 — 개발 환경 fixture 표시 중"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />
      dev fixture
    </span>
  );
}

// Server overview / 상세 endpoint 가 도달 불가일 때 카드 옆에 붙는 빨강 배지.
// 사용처: 활성 디바이스 / DAU / 신고 대기 / 펌웨어 critical / 큐 적체 등
// "원래는 server 정본이어야 하는데 미도달인 상태" 라는 신호.
export function ServerDownBadge({
  label = "Server 미가동",
}: {
  label?: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full bg-rose-50 border border-rose-200 px-2 py-0.5 text-[10px] font-medium text-rose-700"
      title="서버가 응답하지 않아 값을 가져올 수 없습니다."
    >
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />
      {label}
    </span>
  );
}
