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

export function ErrorState({
  message,
  unreachable,
  onRetry,
}: {
  message: string;
  unreachable?: boolean;
  onRetry?: () => void;
}) {
  if (unreachable) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
        <div className="font-medium">Server 미가동</div>
        <div className="mt-1 text-xs text-slate-500">
          ICONIA-SERVER 가 응답하지 않습니다. 라우트가 아직 배포되지 않았을 수 있습니다.
        </div>
        {onRetry ? (
          <button
            className="mt-2 rounded-lg bg-white border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50"
            type="button"
            onClick={onRetry}
          >
            다시 시도
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      조회 실패: {message}
      {onRetry ? (
        <button
          className="ml-2 underline text-xs"
          type="button"
          onClick={onRetry}
        >
          다시 시도
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
      title="Server /api/v1/admin/overview 가 응답하지 않습니다. 표시값이 아닌 '—' 로 표기됩니다."
    >
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" aria-hidden />
      {label}
    </span>
  );
}
