"use client";

// 2026-05-27 — ◈1번 Gemini API Key 사용량 페이지.
// /dashboard/ai-usage — 시계열 (24h / 7d / 30d) + 모델 분포 + 비용 추정 + 키별 사용량.

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import { LineChart, Donut, ProgressBar } from "../_components/SimpleChart";
import { EmptyState, FixtureBadge, LoadingState } from "../_components/CardStates";
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
      {/* 2026-06-04 — 사용자 요청: AI 사용량 페이지의 버튼·진입 패널 제거.
          모니터링 전용으로 축소 (등록·tier 변경은 /dashboard/gemini 에서 직접). */}

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
        description="선택한 기간의 시간대별 호출량 추이."
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
          </div>
        }
      >
        {loading && !usage ? (
          <LoadingState />
        ) : !usage ? (
          <EmptyState title="시계열 데이터 없음" hint={`선택 기간: ${range}`} />
        ) : (
          <LineChart data={linePoints} accent="#6D5DFE" yLabel={`요청 수 — ${range}`} />
        )}
      </PanelCard>

      {/* 2026-06-01 — 사용자 요청: "모델별 분포" + "할당량 알림 (열림)" 패널 제거.
          키 사용량 상세는 아래 "키별 사용량" 패널의 progress bar 색상으로 충분히 표현. */}

      {/* 키별 사용량 */}
      <PanelCard
        title="키별 사용량 — Gemini API Key"
        description="보안을 위해 키의 마지막 4자만 표시됩니다."
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
