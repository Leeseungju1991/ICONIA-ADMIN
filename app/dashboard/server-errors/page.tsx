"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
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

  return (
    <div className="space-y-6">
      <PanelCard
        title="서버 에러"
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
          state.code === "ERR_NETWORK" || state.code === "ERR_SERVER_UNAVAILABLE" ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <div className="font-medium">Server 미가동</div>
              <div className="mt-1 text-xs text-muted">
                ICONIA-SERVER 가 응답하지 않습니다. 에러 발생 여부를 알 수 없음.
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              조회 실패 ({state.code ?? "ERR"}): {state.message}
            </div>
          )
        ) : items.length === 0 ? (
          <div className="text-sm text-emerald-700">✓ 서버 에러 없음.</div>
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
