"use client";

// 2026-05-27 — ◈1번 Gemini API Key 사용량 페이지.
// /dashboard/ai-usage — 시계열 (24h / 7d / 30d) + 모델 분포 + 비용 추정 + 키별 사용량.

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
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
      {/* 2026-06-01 — 사용자 요청: AI 사용량 페이지에 Gemini Key 등록 진입점.
          KeyRegisterForm 자체는 /dashboard/gemini 의 GeminiClient 안에 inline 정의되어 있어
          중복 추출을 피하기 위해 link 로 안내. */}
      <PanelCard
        title="Gemini Key 등록 · 한도 설정"
        description="신규 키 별칭(alias)·tier·일/월 한도를 등록하거나 기존 키의 한도를 갱신합니다."
        actions={
          <Link
            href="/dashboard/gemini"
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium px-3 py-1.5"
          >
            키 등록 폼 열기 →
          </Link>
        }
      >
        <p className="text-xs text-slate-600">
          본 페이지는 사용량·알림 모니터링 전용입니다. 키 등록·tier 변경은
          {" "}<Link href="/dashboard/gemini" className="text-indigo-700 underline">Gemini Key 관리</Link>{" "}
          페이지의 등록 폼에서 수행합니다. 키 평문(secret)은 환경변수 GEMINI_API_KEYS 운영 절차로 추가 후,
          본 등록 폼에서 alias 의 tier·한도만 설정합니다.
        </p>
      </PanelCard>

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
        description="선택한 기간(24h / 7d / 30d) 의 시간대별 호출량 추이."
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
          <EmptyState title="시계열 데이터 없음" hint={`선택 기간: ${range}`} />
        ) : (
          <LineChart data={linePoints} accent="#6D5DFE" yLabel={`요청 수 — ${range}`} />
        )}
      </PanelCard>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PanelCard
          title="모델별 분포"
          description="모델별 호출 수 기준 비율."
        >
          {donutSegments.length === 0 ? (
            <EmptyState title="모델 분해 없음" />
          ) : (
            <Donut segments={donutSegments} />
          )}
        </PanelCard>

        <PanelCard
          title="할당량 알림 (열림)"
          description="80% 도달 시 주의, 95% 이상은 즉시 구매 권장."
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
        description="키 평문은 표시하지 않으며 마지막 4자만 노출합니다."
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
