"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { MockDataBanner } from "../_components/MockDataBanner";
import {
  listServerErrorsAction,
  type StubListResult,
} from "@/lib/actions/stubLists";

// Phase 15-B — server-errors 페이지 재설계.
// Server `GET /api/v1/admin/errors/server` (현재 stub).
// 운영 에러 정본은 CloudWatch + Sentry — 본 화면은 Admin 관점 통합 표면 demo.

export default function ServerErrorsPage() {
  const [state, setState] = useState<StubListResult | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listServerErrorsAction();
      setState(r);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  const items = state && state.ok ? state.items : [];
  const isStub = state && state.ok && state.source === "stub";

  return (
    <div className="space-y-6">
      {isStub ? (
        <MockDataBanner
          reason="운영 에러 정본은 CloudWatch + Sentry. Server 의 errors/server endpoint 는 stub — 향후 두 source 의 Admin 통합 표면."
          endpoint="/api/v1/admin/errors/server (TBD — CloudWatch GetMetricData 또는 audit_logs 합성)"
        />
      ) : null}

      <PanelCard
        title="서버 에러"
        description="AWS API/서비스 5xx · 예외 · 헬스 상태. CloudWatch + Sentry 가 정본, 본 화면은 통합 표면."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        {!state ? (
          <div className="text-sm text-muted">불러오는 중</div>
        ) : !state.ok ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Server 도달 실패: {state.message}
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted">
            서버 에러 없음 — 정상. (source: {state.source})
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((item, i) => (
              <li
                key={String(item.id ?? i)}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-sm"
              >
                <pre className="text-[11px] overflow-x-auto">
                  {JSON.stringify(item, null, 2)}
                </pre>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  );
}
