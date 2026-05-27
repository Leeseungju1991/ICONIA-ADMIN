"use client";

// 2026-05-27 — ◈1번 Gemini API Key 사용량 페이지.
// /dashboard/ai-usage — 시계열 (24h / 7d / 30d) + 모델 분포 + 비용 추정 + 키별 사용량.

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import { LineChart, Donut, ProgressBar } from "../_components/SimpleChart";
import { EmptyState, FixtureBadge, LoadingState } from "../_components/CardStates";
import { GeminiManagementPanel } from "../_components/GeminiManagementPanel";
import {
  fetchGeminiKeysAction,
  fetchGeminiQuotaAlertsAction,
  fetchGeminiUsageAction,
} from "@/lib/actions/gemini";
import type {
  GeminiKeyRow,
  GeminiKeysResponse,
  GeminiQuotaAlertsResponse,
  GeminiUsageResponse,
} from "@/types/admin-api";
import { geminiRatioTone, summarizeKeys } from "@/fixtures/gemini";

type Range = "24h" | "7d" | "30d";

const MODEL_COLORS = ["#6D5DFE", "#60A5FA", "#14B8A6", "#F97316", "#EC4899"];

export default function AiUsagePage() {
  const [range, setRange] = useState<Range>("24h");
  const [keys, setKeys] = useState<GeminiKeysResponse | null>(null);
  const [usage, setUsage] = useState<GeminiUsageResponse | null>(null);
  const [alerts, setAlerts] = useState<GeminiQuotaAlertsResponse | null>(null);
  const [error, setError] = useState<{ message: string; unreachable: boolean } | null>(null);
  const [source, setSource] = useState<"server" | "fixture" | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const [k, u, a] = await Promise.all([
        fetchGeminiKeysAction(),
        fetchGeminiUsageAction(range),
        fetchGeminiQuotaAlertsAction(),
      ]);
      if (k.ok) {
        setKeys(k.data);
        setSource(k.source);
      } else {
        setError({ message: k.message, unreachable: !!k.unreachable });
        setKeys(null);
      }
      if (u.ok) setUsage(u.data);
      if (a.ok) setAlerts(a.data);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const summary = useMemo(
    () => (keys ? summarizeKeys(keys.items) : { total: 0, active: 0, warn: 0, critical: 0 }),
    [keys],
  );

  // Tier 분포 — 운영 매뉴얼 패널에서 "free 1 · tier1 2" 형태로 노출.
  const tierBreakdown = useMemo(() => {
    if (!keys || keys.items.length === 0) return "—";
    const counts: Record<string, number> = {};
    for (const k of keys.items) {
      counts[k.tier] = (counts[k.tier] || 0) + 1;
    }
    return Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([tier, n]) => `${tier} ${n}`)
      .join(" · ");
  }, [keys]);

  const linePoints = useMemo(() => {
    if (!usage) return [];
    return usage.points.map((p) => ({
      x: range === "24h"
        ? new Date(p.at).toLocaleTimeString("ko-KR", { hour: "2-digit" })
        : new Date(p.at).toLocaleDateString("ko-KR", { month: "2-digit", day: "2-digit" }),
      y: p.requests,
    }));
  }, [usage, range]);

  const donutSegments = useMemo(() => {
    if (!usage) return [];
    return usage.by_model.map((m, i) => ({
      label: m.model,
      value: m.requests,
      color: MODEL_COLORS[i % MODEL_COLORS.length],
    }));
  }, [usage]);

  return (
    <div className="space-y-6">
      {/* 상단 요약 */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="등록 키"
          value={String(summary.total)}
          delta={`활성 ${summary.active}`}
          deltaTone="up"
          hint="Server 정본"
          accent="blue"
        />
        <StatCard
          label="80%+ 키"
          value={String(summary.warn)}
          delta={summary.warn > 0 ? "주의" : "없음"}
          deltaTone={summary.warn > 0 ? "down" : "up"}
          hint="일일 한도 80~95%"
          accent="orange"
        />
        <StatCard
          label="95%+ 키"
          value={String(summary.critical)}
          delta={summary.critical > 0 ? "구매 권장" : "여유"}
          deltaTone={summary.critical > 0 ? "down" : "up"}
          hint="일일 한도 95% 도달"
          accent="pink"
        />
        <StatCard
          label="총 요청 (range)"
          value={usage ? usage.total_requests.toLocaleString() : "—"}
          delta={
            usage
              ? `토큰 ${(usage.total_tokens / 1_000_000).toFixed(2)}M`
              : ""
          }
          deltaTone="flat"
          hint={`추정 비용 $${usage ? usage.total_cost_usd.toFixed(2) : "0.00"}`}
          accent="teal"
        />
      </section>

      {/* 시계열 차트 */}
      <PanelCard
        title="시간대별 Gemini 호출"
        description="GET /api/admin/gemini/usage?range=… — server 가 1시간(24h) / 1일(7d/30d) bucket 집계."
        actions={
          <div className="flex items-center gap-2">
            {source === "fixture" ? <FixtureBadge /> : null}
            <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
              {(["24h", "7d", "30d"] as Range[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRange(r)}
                  className={[
                    "px-3 py-1 text-xs",
                    range === r ? "bg-accent text-white" : "bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-lg bg-white border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "조회 중..." : "새로고침"}
            </button>
          </div>
        }
      >
        {loading && !usage ? (
          <LoadingState />
        ) : !usage ? (
          <EmptyState title="시계열 데이터 없음" hint={`/api/admin/gemini/usage?range=${range}`} />
        ) : (
          <LineChart data={linePoints} accent="#6D5DFE" yLabel={`요청 수 — ${range}`} />
        )}
      </PanelCard>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PanelCard
          title="모델별 분포"
          description="`by_model` 응답 기반. 호출 수 기준 비율."
        >
          {donutSegments.length === 0 ? (
            <EmptyState title="모델 분해 없음" />
          ) : (
            <Donut segments={donutSegments} />
          )}
        </PanelCard>

        <PanelCard
          title="할당량 알림 (열림)"
          description="80% 도달 시 warn, 95%+ critical. server 가 5분마다 평가."
        >
          {!alerts || alerts.items.length === 0 ? (
            <EmptyState title="활성 알림 없음" hint="모든 키가 일일 한도 80% 미만." />
          ) : (
            <ul className="space-y-2">
              {alerts.items.map((a) => (
                <li
                  key={a.id}
                  className={[
                    "rounded-xl border px-3 py-2 text-sm flex items-center justify-between",
                    a.level === "critical"
                      ? "border-rose-200 bg-rose-50"
                      : "border-amber-200 bg-amber-50",
                  ].join(" ")}
                >
                  <div>
                    <div className="font-medium text-slate-800">{a.key_label}</div>
                    <div className="text-[11px] text-slate-500">
                      열린지 {Math.max(1, Math.round((Date.now() - new Date(a.opened_at).getTime()) / 60_000))}분
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={
                        a.level === "critical" ? "chip chip-error" : "chip chip-warn"
                      }
                    >
                      {Math.round(a.ratio * 100)}%
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>
      </section>

      {/* 키별 사용량 */}
      <PanelCard
        title="키별 사용량 — Gemini API Key"
        description="GET /api/admin/gemini/keys — 키 평문 노출 금지, 마지막 4자만 표시."
        actions={source === "fixture" ? <FixtureBadge /> : null}
      >
        {error ? (
          <EmptyState title="등록된 키 없음" />
        ) : !keys ? (
          <LoadingState />
        ) : keys.items.length === 0 ? (
          <EmptyState title="등록된 키 없음" />
        ) : (
          <ul className="space-y-2">
            {keys.items.map((k) => (
              <GeminiKeyCard key={k.id} k={k} />
            ))}
          </ul>
        )}
      </PanelCard>

      {/* 2026-05-27 — Gemini 키 관리 방안 (docs/Gemini-API-Key-운영가이드.md 임베드). */}
      <GeminiManagementPanel
        totalKeys={summary.total}
        activeKeys={summary.active}
        criticalKeys={summary.critical}
        tierBreakdown={tierBreakdown}
      />
    </div>
  );
}

function GeminiKeyCard({ k }: { k: GeminiKeyRow }) {
  const tone = geminiRatioTone(k.usage_ratio_24h);
  const borderTone =
    tone === "critical"
      ? "border-rose-300 bg-rose-50/50"
      : tone === "warn"
        ? "border-amber-300 bg-amber-50/50"
        : "border-slate-200 bg-white";
  return (
    <li className={`rounded-xl border ${borderTone} px-4 py-3`}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{k.label}</span>
            <span className="font-mono text-[11px] text-slate-500">…{k.last4}</span>
            <span className="chip chip-muted">{k.tier}</span>
            <span
              className={
                k.status === "active"
                  ? "chip chip-success"
                  : k.status === "exhausted"
                    ? "chip chip-error"
                    : "chip chip-warn"
              }
            >
              {k.status}
            </span>
            {tone === "critical" ? (
              <span className="chip chip-error">구매 권장</span>
            ) : tone === "warn" ? (
              <span className="chip chip-warn">주의</span>
            ) : null}
          </div>
          <div className="mt-2 text-xs text-slate-600 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <KeyMetric label="24h 요청" value={k.requests_24h.toLocaleString()} />
            <KeyMetric label="24h 토큰" value={`${(k.tokens_24h / 1_000_000).toFixed(2)}M`} />
            <KeyMetric label="월 요청" value={k.requests_mtd.toLocaleString()} />
            <KeyMetric label="월 토큰" value={`${(k.tokens_mtd / 1_000_000).toFixed(1)}M`} />
          </div>
        </div>
        <div className="w-full sm:w-56 shrink-0">
          <ProgressBar
            ratio={k.usage_ratio_24h}
            tone={tone}
            label={`일일 한도 대비 (${Math.round(k.usage_ratio_24h * 100)}%)`}
          />
          <div className="mt-1 text-[10px] text-slate-500 font-mono">
            한도: {k.requests_daily_limit?.toLocaleString() ?? "—"} req / {((k.tokens_daily_limit ?? 0) / 1_000_000).toFixed(1)}M tok
          </div>
        </div>
      </div>
    </li>
  );
}

function KeyMetric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className="font-mono text-slate-800">{value}</div>
    </div>
  );
}
