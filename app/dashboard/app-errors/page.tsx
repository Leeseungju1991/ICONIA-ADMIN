"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { MockDataBanner } from "../_components/MockDataBanner";
import {
  listAppErrorsAction,
  type StubListResult,
} from "@/lib/actions/stubLists";

// Phase 15-B — app-errors 페이지 재설계.
// Server `GET /api/v1/admin/errors/app` (현재 stub).
// RN App errorReporter 가 향후 collect endpoint 또는 Sentry 로 송출 예정 — 본 화면은 통합 표면.

export default function AppErrorsPage() {
  const [state, setState] = useState<StubListResult | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listAppErrorsAction();
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
          reason="RN App errorReporter → Sentry 또는 별도 collect endpoint 로 송출 예정. Server 의 errors/app endpoint 는 stub."
          endpoint="/api/v1/admin/errors/app (TBD)"
        />
      ) : null}

      <PanelCard
        title="앱 에러"
        description="RN Expo 모바일 앱 크래시 · 런타임 에러. Server /api/v1/admin/errors/app 정본."
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
            앱 에러 없음. (source: {state.source})
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
