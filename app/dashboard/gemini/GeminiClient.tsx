"use client";

// 2026-06-10 — Gemini API KEY 관리 페이지 단순화.
//   레이아웃: (1) one-box 등록 폼 + (2) 등록된 키 목록 + (3) 총 사용량 게이지 한 줄.
//   alias/tier/rpm/tpm/rpd/monthly_token_cap/models 등록 폼은 모두 제거됨 (sibling concern).
//   평문 KEY 는 등록 폼 입력 시점에만 존재 — 응답/목록에는 prefix 4자 + alias 만.
// 2026-06-10 — 사용량 게이지를 Free Tier 한도 기반으로 교체. 사용자는 무료 키만
//   등록하므로 monthly_token_cap (custom tier 가정) 대신 Google 공식 Free Tier
//   한도 × 활성 키 수로 측정한다. 1차 지표: 오늘 RPD. 보조: 30일 토큰 누적.

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { PanelCard } from "../_components/PanelCard";
import {
  addKeyStoreAction,
  disableKeyStoreAction,
  keysStoreUsageSummaryAction,
  listKeysStoreAction,
} from "@/lib/actions/geminiKeysStore";
import { fetchGeminiUsageAction } from "@/lib/actions/gemini";
import {
  FREE_TIER_CAPS_PER_KEY,
  FREE_TIER_MODEL_LABEL,
  freeTierTotalCap,
  freeTierPercent,
  freeTierTone,
  type FreeTierTone,
} from "@/lib/geminiFreeTier";
import type {
  GeminiKeysStoreItem,
  GeminiKeysStoreUsageSummary,
} from "@/lib/adminApi";
import type { GeminiUsageResponse } from "@/types/admin-api";

export default function GeminiClient() {
  const [items, setItems] = useState<GeminiKeysStoreItem[]>([]);
  const [summary, setSummary] = useState<GeminiKeysStoreUsageSummary | null>(null);
  const [usage24h, setUsage24h] = useState<GeminiUsageResponse | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [, startLoad] = useTransition();
  const [mutating, startMutate] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(() => {
    startLoad(async () => {
      const [keysRes, sumRes, u24Res] = await Promise.all([
        listKeysStoreAction(),
        keysStoreUsageSummaryAction("30d"),
        fetchGeminiUsageAction("24h"),
      ]);
      if (keysRes.ok) setItems(keysRes.data.items);
      else setItems([]);
      if (sumRes.ok) setSummary(sumRes.data);
      else setSummary(null);
      if (u24Res.ok) setUsage24h(u24Res.data);
      else setUsage24h(null);
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function handleRegister(e: FormEvent) {
    e.preventDefault();
    const trimmed = apiKey.trim();
    if (!trimmed || mutating) return;
    startMutate(async () => {
      const r = await addKeyStoreAction(trimmed);
      if (!r.ok) {
        setToast(`등록 실패: ${r.message}`);
        return;
      }
      setApiKey("");
      setToast(
        r.data.reactivated
          ? `재활성화: ${r.data.item.alias} (${r.data.item.keyPrefix}***)`
          : `등록 완료: ${r.data.item.alias} (${r.data.item.keyPrefix}***)`,
      );
      reload();
    });
  }

  function handleDisable(item: GeminiKeysStoreItem) {
    if (item.status !== "active") return;
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `[${item.alias}] (${item.keyPrefix}***) 키를 해제(비활성)하시겠습니까?\n해제 후에는 AI 서비스가 본 키를 사용하지 않습니다.`,
      );
      if (!ok) return;
    }
    startMutate(async () => {
      const r = await disableKeyStoreAction(item.id);
      if (!r.ok) {
        setToast(`해제 실패: ${r.message}`);
        return;
      }
      setToast(`해제 완료: ${item.alias}`);
      reload();
    });
  }

  return (
    <div className="space-y-6">
      {/* ───────────────── 1. one-box 등록 ───────────────── */}
      <PanelCard
        title="Gemini API KEY"
        description="새 API KEY 1개를 입력하고 등록 버튼을 누르세요. 평문은 응답·목록에 절대 노출되지 않습니다."
      >
        <form onSubmit={handleRegister} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 text-xs text-slate-700">
            <span className="font-semibold text-slate-900 text-sm">API KEY</span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIza..."
              autoComplete="off"
              spellCheck={false}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono min-h-[44px]"
              maxLength={256}
              disabled={mutating}
            />
          </label>
          <button
            type="submit"
            disabled={!apiKey.trim() || mutating}
            className="inline-flex items-center justify-center rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base px-6 py-3 min-h-[44px] shadow-card transition-colors"
          >
            {mutating ? "처리 중..." : "등록"}
          </button>
        </form>
      </PanelCard>

      {/* ───────────────── 2. 등록된 키 목록 ───────────────── */}
      <PanelCard title="등록된 키" description={`${items.length} 건`}>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-8 text-center text-sm text-muted">
            등록된 키가 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-slate-200">
                  <th className="py-2 pr-3 font-medium">키</th>
                  <th className="py-2 pr-3 font-medium">alias</th>
                  <th className="py-2 pr-3 font-medium">상태</th>
                  <th className="py-2 pr-3 font-medium">등록일</th>
                  <th className="py-2 pr-3 font-medium text-right">조치</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-3 font-mono text-slate-900">
                      {item.keyPrefix}***
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{item.alias}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          item.status === "active"
                            ? "inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs"
                            : "inline-flex items-center rounded-full bg-slate-200 text-slate-700 px-2 py-0.5 text-xs"
                        }
                      >
                        {item.status === "active" ? "활성" : "해제됨"}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDisable(item)}
                        disabled={item.status !== "active" || mutating}
                        className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
                      >
                        해제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      {/* ───────────────── 3. 사용량 게이지 (Free Tier 기준) ───────────────── */}
      <PanelCard
        title="사용량"
        description="등록된 모든 활성 키 합산 — Google AI Studio Free Tier 한도 기준"
      >
        <UsageGauge
          items={items}
          summary={summary}
          usage24h={usage24h}
        />
      </PanelCard>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card">
          {toast}
          <button
            className="ml-3 underline opacity-80"
            onClick={() => setToast(null)}
            type="button"
          >
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────────
// 2026-06-10 — Free Tier 한도 기반 사용량 게이지. 1차 지표는 오늘 RPD
// (fetchGeminiUsageAction("24h").total_requests / (1500 × 활성 키 수)).
// 보조 표시: 30일 토큰 누적 (keysStoreUsageSummary). RPM/TPM 은 server 에
// 분 단위 집계 endpoint 가 없어 정확 측정 불가 — "데이터 없음" 으로 graceful 노출.
function UsageGauge({
  items,
  summary,
  usage24h,
}: {
  items: GeminiKeysStoreItem[];
  summary: GeminiKeysStoreUsageSummary | null;
  usage24h: GeminiUsageResponse | null;
}) {
  const activeKeys = items.filter((k) => k.status === "active").length;
  const requestsToday = usage24h?.total_requests ?? null;
  const tokens30d = summary?.totals.tokens ?? null;
  const cost30d = summary?.totals.costUsd ?? null;

  const rpdCap = freeTierTotalCap("rpd", activeKeys);
  const rpdPct =
    requestsToday != null && rpdCap > 0
      ? freeTierPercent(requestsToday, "rpd", activeKeys)
      : null;
  const rpdTone = freeTierTone(rpdPct);

  const tierBadgeNote =
    activeKeys > 0
      ? `Free Tier · ${FREE_TIER_MODEL_LABEL} · ${FREE_TIER_CAPS_PER_KEY.rpd}/일 · ${FREE_TIER_CAPS_PER_KEY.rpm}/분 · ${(FREE_TIER_CAPS_PER_KEY.tpm / 1_000_000).toFixed(0)}M tok/분 · per key × ${activeKeys}개`
      : "Free Tier · 활성 키 없음";

  return (
    <div className="space-y-4">
      {/* Free Tier 한도 배지 */}
      <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-800">
        <span className="font-semibold">Free Tier 한도</span>
        <span className="text-emerald-700/80">{tierBadgeNote}</span>
      </div>

      {/* 1차 지표: 오늘 RPD */}
      <Gauge
        label="오늘 RPD"
        sub={
          activeKeys > 0
            ? `${FREE_TIER_CAPS_PER_KEY.rpd}/일 × ${activeKeys}키`
            : "활성 키 없음"
        }
        used={requestsToday}
        cap={rpdCap}
        pct={rpdPct}
        tone={rpdTone}
        format={(n) => n.toLocaleString()}
        unavailable={
          usage24h == null
            ? "Server 응답 없음 (Gemini /usage)"
            : activeKeys === 0
              ? "활성 키가 없습니다"
              : null
        }
      />

      {/* RPM / TPM 자리 — server 가 분 단위 집계를 노출하지 않아 안내만. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <UnavailableMetric
          label="이번 분 RPM"
          sub={
            activeKeys > 0
              ? `한도 ${FREE_TIER_CAPS_PER_KEY.rpm * activeKeys} (${FREE_TIER_CAPS_PER_KEY.rpm}/분 × ${activeKeys}키)`
              : `한도 ${FREE_TIER_CAPS_PER_KEY.rpm}/분 per key`
          }
          note="Server 가 분 단위 집계를 미노출 — RPD 게이지로 갈음"
        />
        <UnavailableMetric
          label="이번 분 TPM"
          sub={
            activeKeys > 0
              ? `한도 ${(FREE_TIER_CAPS_PER_KEY.tpm * activeKeys / 1_000_000).toFixed(0)}M (${(FREE_TIER_CAPS_PER_KEY.tpm / 1_000_000).toFixed(0)}M/분 × ${activeKeys}키)`
              : `한도 ${(FREE_TIER_CAPS_PER_KEY.tpm / 1_000_000).toFixed(0)}M/분 per key`
          }
          note="Server 가 분 단위 집계를 미노출 — RPD 게이지로 갈음"
        />
      </div>

      {/* 보조: 30일 토큰 누적 + 추정 비용 (Free Tier 한도와는 무관 — 사용 패턴 참고용) */}
      <div className="rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs text-slate-600">
        <div className="font-medium text-slate-700">최근 30일 누적 (참고)</div>
        <div className="mt-1">
          토큰 {tokens30d != null ? formatM(tokens30d) : "—"} · 추정 비용 $
          {cost30d != null ? cost30d.toFixed(2) : "—"} · 활성 키 {activeKeys}개
        </div>
      </div>

      <div className="text-[11px] text-slate-500 leading-relaxed">
        Free Tier 기준 한도입니다. 유료 키는 별도로 한도 계산이 변경됩니다.
        한도 출처: Google AI Studio (gemini-2.0-flash 무료 등급 — per key 1500 RPD / 15 RPM / 1M TPM).
      </div>
    </div>
  );
}

function Gauge({
  label,
  sub,
  used,
  cap,
  pct,
  tone,
  format,
  unavailable,
}: {
  label: string;
  sub: string;
  used: number | null;
  cap: number;
  pct: number | null;
  tone: FreeTierTone;
  format: (n: number) => string;
  unavailable: string | null;
}) {
  const TONE_BAR: Record<FreeTierTone, string> = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
    rose: "bg-rose-500",
    slate: "bg-slate-300",
  };
  const TONE_TXT: Record<FreeTierTone, string> = {
    emerald: "text-emerald-700",
    amber: "text-amber-700",
    rose: "text-rose-700",
    slate: "text-slate-600",
  };
  const fillPct = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-slate-900">{label}</div>
          <div className="text-[11px] text-slate-500">{sub}</div>
        </div>
        <div className={`text-sm font-mono ${TONE_TXT[tone]}`}>
          {unavailable
            ? "—"
            : `${format(used ?? 0)} / ${format(cap)}${pct != null ? ` (${pct.toFixed(1)}%)` : ""}`}
        </div>
      </div>
      <div className="mt-2 h-3 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full ${TONE_BAR[tone]} transition-[width] duration-500`}
          style={{ width: `${fillPct}%` }}
          aria-label={`${label} usage bar`}
        />
      </div>
      {unavailable ? (
        <div className="mt-1 text-[11px] text-slate-500">{unavailable}</div>
      ) : null}
    </div>
  );
}

function UnavailableMetric({
  label,
  sub,
  note,
}: {
  label: string;
  sub: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/40 px-3 py-3">
      <div className="text-sm font-semibold text-slate-700">{label}</div>
      <div className="text-[11px] text-slate-500">{sub}</div>
      <div className="mt-2 text-[11px] text-slate-400">{note}</div>
    </div>
  );
}

function formatM(n: number): string {
  if (!Number.isFinite(n)) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(2)}k`;
  return String(n);
}

function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  } catch {
    return iso;
  }
}
