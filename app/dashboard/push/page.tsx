"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { MockDataBanner } from "../_components/MockDataBanner";
import { listPushCampaignsAction, type StubListResult } from "@/lib/actions/stubLists";

// Phase 15-B — push 페이지 재설계.
// Server `GET /api/v1/admin/push/campaigns` (현재 stub).
// 실 푸시 발송은 expoPushService + proactiveScheduler 가 처리 — 본 화면은 캠페인 UI.

export default function PushPage() {
  const [state, setState] = useState<StubListResult | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listPushCampaignsAction();
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
          reason="expoPushService 는 proactiveScheduler 가 정본 발송 — 본 캠페인 모델/CRUD 는 Phase 15-A 진행 중."
          endpoint="POST /api/v1/admin/push/campaigns (TBD)"
        />
      ) : null}

      <PanelCard
        title="푸시 캠페인"
        description="전체/세그먼트 푸시 발송 + 결과 추적. Server /api/v1/admin/push/campaigns."
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
            발송된 캠페인이 없습니다. (source: {state.source})
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
