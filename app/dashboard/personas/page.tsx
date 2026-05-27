"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import {
  listPersonasAction,
  type ListPersonasResult,
} from "@/lib/actions/personas";
import { getAiHealthAction } from "@/lib/actions/aiHealth";
import type { AdminPersonaRow, AiHealthSnapshot } from "@/lib/adminApi";

// Phase 14-C — personas 재설계.
// Server `GET /api/v1/admin/personas` (Phase 1) + `GET /api/v1/admin/ai-health` (by_soul_catalog_id 차원).
// 응답: { personas: AdminPersonaRow[], catalog_error } + cost / latency 등.
//
// 이전: mockPersonas (state/language/voice_id/soul_size/active_sessions) DataTable + 라이브 전환 액션.
// 재설계: SOUL 카탈로그 카드 그리드. status (live/staged) + fallback_rate + last_response + 비용 차원 합산.

const statusChip: Record<string, string> = {
  live: "chip chip-success",
  staged: "chip chip-info",
  draft: "chip chip-muted",
  archived: "chip chip-warn",
};

export default function PersonasPage() {
  const [statusFilter, setStatusFilter] = useState<"all" | string>("all");
  const [state, setState] = useState<ListPersonasResult | null>(null);
  const [aiSnap, setAiSnap] = useState<AiHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const [r, a] = await Promise.all([
        listPersonasAction(),
        getAiHealthAction(),
      ]);
      setState(r);
      if (a.ok) setAiSnap(a.snapshot);
      if (!r.ok) setError(r.message);
      else setError(null);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    if (!state || !state.ok) return [];
    if (statusFilter === "all") return state.personas;
    return state.personas.filter((p) => p.status === statusFilter);
  }, [state, statusFilter]);

  const stats = useMemo(() => {
    if (!state || !state.ok) return { total: 0, live: 0, staged: 0 };
    const live = state.personas.filter((p) => p.status === "live").length;
    const staged = state.personas.filter((p) => p.status === "staged").length;
    return { total: state.personas.length, live, staged };
  }, [state]);

  const byKindCost = aiSnap?.cost?.by_kind;
  const totalCost = aiSnap?.cost?.total_krw ?? 0;

  function findSoulMetric(soul_catalog_id: string) {
    return aiSnap?.by_soul_catalog_id?.[soul_catalog_id];
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="등록 SOUL"
          value={String(stats.total)}
          hint="Server PersonaClient.listCatalog"
          accent="purple"
        />
        <StatCard
          label="라이브"
          value={String(stats.live)}
          hint="status=live"
          accent="teal"
        />
        <StatCard
          label="검수 중"
          value={String(stats.staged)}
          hint="status=staged"
          accent="orange"
        />
        <StatCard
          label="총 AI 비용 (KRW)"
          value={`₩${Math.round(totalCost).toLocaleString()}`}
          hint="aiHealthTracker 5분 윈도우"
          accent="pink"
        />
      </section>

      <PanelCard
        title="SOUL 카탈로그 — Server 정본"
        description="Server /api/v1/admin/personas + aiHealthTracker.snapshot().by_soul_catalog_id 결합. 페르소나별 fallback_rate · last_response · 누적 비용."
        actions={
          <>
            <select
              className="select max-w-[140px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">전체</option>
              <option value="live">라이브</option>
              <option value="staged">검수 중</option>
              <option value="draft">초안</option>
              <option value="archived">보관</option>
            </select>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
            >
              {loading ? "조회 중..." : "새로고침"}
            </button>
          </>
        }
      >
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Server 도달 실패: {error}
          </div>
        ) : !state ? (
          <div className="text-sm text-muted">불러오는 중</div>
        ) : !state.ok ? null : state.personas.length === 0 ? (
          <div className="text-sm text-muted">등록된 SOUL 이 없습니다.</div>
        ) : (
          <>
            {state.catalog_error ? (
              <div className="mb-3 text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
                ⚠ AI 카탈로그 일부 누락: {state.catalog_error.code} — {state.catalog_error.message}
              </div>
            ) : null}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {filtered.map((p) => (
                <SoulCard key={p.soul_catalog_id} persona={p} metric={findSoulMetric(p.soul_catalog_id)} />
              ))}
            </div>
          </>
        )}
      </PanelCard>

      {byKindCost ? (
        <PanelCard
          title="응답 종류별 비용 분포"
          description="AI metricsBuffer.by_kind — text / voice / vision 별 누적 USD/KRW."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
            {(["text", "voice", "vision"] as const).map((k) => (
              <div
                key={k}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2"
              >
                <div className="text-xs text-muted uppercase">{k}</div>
                <div className="mt-1 font-semibold">
                  ₩{Math.round(byKindCost[k]?.krw ?? 0).toLocaleString()}
                </div>
                <div className="text-[11px] text-muted">
                  ${(byKindCost[k]?.usd ?? 0).toFixed(4)}
                </div>
              </div>
            ))}
          </div>
        </PanelCard>
      ) : null}

    </div>
  );
}

function SoulCard({
  persona,
  metric,
}: {
  persona: AdminPersonaRow;
  metric?: {
    total: number;
    success_rate: number;
    fallback_rate: number;
    latency_ms_avg: number;
    last_ts: number | null;
  };
}) {
  const fallbackRate =
    typeof persona.fallback_rate === "number"
      ? persona.fallback_rate
      : metric?.fallback_rate;
  return (
    <div className="rounded-xl border border-white/60 bg-white/60 px-3 py-3">
      <div className="flex items-center justify-between">
        <div className="font-medium text-slate-800">{persona.name}</div>
        <span className={statusChip[persona.status] ?? "chip chip-muted"}>
          {persona.status}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-muted font-mono">{persona.soul_catalog_id}</div>

      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
        <div>
          <div className="text-muted text-[10px]">fallback</div>
          <div
            className={
              typeof fallbackRate === "number" && fallbackRate > 0.1
                ? "text-red-600 font-medium"
                : "text-slate-800"
            }
          >
            {typeof fallbackRate === "number" ? `${(fallbackRate * 100).toFixed(1)}%` : "—"}
          </div>
        </div>
        <div>
          <div className="text-muted text-[10px]">latency avg</div>
          <div className="text-slate-800">
            {metric ? `${Math.round(metric.latency_ms_avg)}ms` : "—"}
          </div>
        </div>
        <div>
          <div className="text-muted text-[10px]">호출 수</div>
          <div className="text-slate-800">
            {metric ? metric.total.toLocaleString() : "—"}
          </div>
        </div>
        <div>
          <div className="text-muted text-[10px]">success rate</div>
          <div className="text-slate-800">
            {metric ? `${(metric.success_rate * 100).toFixed(1)}%` : "—"}
          </div>
        </div>
      </div>

      <div className="mt-2 text-[10px] text-muted">
        마지막 응답: {persona.last_response_ts ?? (metric?.last_ts ? new Date(metric.last_ts).toISOString() : "—")}
      </div>
    </div>
  );
}
