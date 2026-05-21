"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { MockDataBanner } from "../_components/MockDataBanner";
import { listNoticesAction, type StubListResult } from "@/lib/actions/stubLists";

// Phase 15-B — notices 페이지 재설계.
// Server `GET /api/v1/admin/notices` (현재 stub: items=[], source="stub").
// Phase 15-A 가 notice 모델 + CRUD wire 하면 자동으로 채워짐.

export default function NoticesPage() {
  const [state, setState] = useState<StubListResult | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listNoticesAction();
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
          reason="Server endpoint 는 응답하지만 Notice 모델/CRUD 가 아직 stub (Phase 15-A 진행 중). 작성/편집 UI 는 다음 라운드."
          endpoint="POST /api/v1/admin/notices (TBD)"
        />
      ) : null}

      <PanelCard
        title="공지·배너 목록"
        description="앱·웹 공지/배너. Server /api/v1/admin/notices 정본."
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
            공지가 없습니다. (source: {state.source})
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
