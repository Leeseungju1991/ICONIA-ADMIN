"use client";

// Next.js 14 App Router error boundary — 모든 RSC / client 렌더 에러를 catch.
// global-error.tsx 가 layout 자체 실패를 잡고, 본 파일은 페이지 단위 실패를 잡는다.
// 운영자 콘솔은 절대 빈 화면을 노출하지 않고 graceful fallback 을 표시한다.

import { useEffect } from "react";

export default function GlobalErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 운영 콘솔 — 추후 Sentry 등 에러 수집기 통합 지점. 현재는 console 만.
    // PII 가 메시지에 들어 있을 가능성을 고려해 외부 전송은 의도적 보류.
    // eslint-disable-next-line no-console
    console.error("[admin] page error boundary", {
      message: error.message,
      digest: error.digest,
    });
  }, [error]);

  return (
    <div className="p-6 sm:p-10 max-w-2xl mx-auto">
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-xl font-bold">
            !
          </div>
          <div>
            <h1 className="text-lg font-semibold text-red-900">
              화면을 표시하지 못했습니다
            </h1>
            <p className="text-xs text-red-700 mt-0.5">
              일시적 오류일 수 있습니다. 다시 시도해 주세요.
            </p>
          </div>
        </div>
        <div className="mt-5 rounded-xl bg-white border border-red-100 p-3">
          <div className="text-[11px] text-muted">메시지</div>
          <div className="text-sm font-mono text-slate-800 break-all">
            {error.message || "Unknown error"}
          </div>
          {error.digest ? (
            <div className="mt-2 text-[11px] text-muted">
              digest: <code className="font-mono">{error.digest}</code>
            </div>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-xl bg-slate-900 text-white text-sm px-4 py-2"
          >
            다시 시도
          </button>
          <a
            href="/dashboard"
            className="rounded-xl bg-white border border-slate-300 text-slate-700 text-sm px-4 py-2 hover:bg-slate-50"
          >
            대시보드로
          </a>
          <a
            href="/dashboard/ops/runbook"
            className="rounded-xl bg-white border border-slate-300 text-slate-700 text-sm px-4 py-2 hover:bg-slate-50"
          >
            장애 대응 runbook
          </a>
        </div>
      </div>
    </div>
  );
}
