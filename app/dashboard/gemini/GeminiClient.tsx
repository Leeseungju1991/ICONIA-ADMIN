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
      // 2026-06-11 — 해제(혹은 legacy disabled) 키는 화면에서 완전히 가린다.
      //   서버가 active 만 반환하지만, 과거 데이터 호환을 위해 클라에서도 한 번 더 거른다.
      if (keysRes.ok) setItems(keysRes.data.items.filter((k) => k.status === "active"));
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
      // 2026-06-11 — soft disable → hard delete 정책 변경에 맞춰 문구 갱신.
      const ok = window.confirm(
        `[${item.alias}] (${item.keyPrefix}***) 키를 삭제하시겠습니까?\n삭제 후에는 목록과 AI 서비스 polling 양쪽에서 즉시 사라지며, 복구할 수 없습니다.`,
      );
      if (!ok) return;
    }
    // 낙관적 제거: 응답을 기다리지 않고 화면에서 먼저 행을 가린다.
    //   reload() 가 곧 active 목록으로 덮어쓰지만, 사용자에게 즉시 피드백이 간다.
    setItems((prev) => prev.filter((k) => k.id !== item.id));
    startMutate(async () => {
      const r = await disableKeyStoreAction(item.id);
      if (!r.ok) {
        setToast(`삭제 실패: ${r.message}`);
        reload(); // 실패 시 서버 상태로 되돌린다.
        return;
      }
      setToast(`삭제 완료: ${item.alias}`);
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
                {/*
                  2026-06-11 — 해제(disabled) 행은 server·client 양쪽에서 가린다.
                  status 컬럼은 legacy 호환을 위해 응답 타입에 남아 있지만,
                  실제로 렌더되는 행은 전부 active 만 들어온다.
                */}
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100 last:border-b-0">
                    <td className="py-2 pr-3 font-mono text-slate-900">
                      {item.keyPrefix}***
                    </td>
                    <td className="py-2 pr-3 text-slate-700">{item.alias}</td>
                    <td className="py-2 pr-3">
                      <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs">
                        활성
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs text-slate-600">
                      {formatDate(item.createdAt)}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDisable(item)}
                        disabled={mutating}
                        className="rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs text-rose-700 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px]"
                      >
                        삭제
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

      {/* 2026-06-15 (사용자 요청 #11) — 라벨 "오늘 RPD" → "오늘의 사용량".
          Gauge 바 아래의 unavailable 텍스트 자리 그대로 유지(에러 안내). */}
      <Gauge
        label="오늘의 사용량"
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

      {/* 2026-06-15 (사용자 요청 #11) — "이번 분 RPM/TPM" 카드 + "최근 30일 누적" 안내 + Free Tier 안내 문구
          전부 제거. 사용량 게이지만 단독 노출하여 화면을 단순화. */}
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
