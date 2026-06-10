"use client";

// 2026-06-10 — Gemini API KEY 관리 페이지 단순화.
//   레이아웃: (1) one-box 등록 폼 + (2) 등록된 키 목록 + (3) 총 사용량 게이지 한 줄.
//   alias/tier/rpm/tpm/rpd/monthly_token_cap/models 등록 폼은 모두 제거됨 (sibling concern).
//   평문 KEY 는 등록 폼 입력 시점에만 존재 — 응답/목록에는 prefix 4자 + alias 만.

import { useCallback, useEffect, useState, useTransition, type FormEvent } from "react";
import { PanelCard } from "../_components/PanelCard";
import {
  addKeyStoreAction,
  disableKeyStoreAction,
  keysStoreUsageSummaryAction,
  listKeysStoreAction,
} from "@/lib/actions/geminiKeysStore";
import type {
  GeminiKeysStoreItem,
  GeminiKeysStoreUsageSummary,
} from "@/lib/adminApi";

export default function GeminiClient() {
  const [items, setItems] = useState<GeminiKeysStoreItem[]>([]);
  const [summary, setSummary] = useState<GeminiKeysStoreUsageSummary | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [, startLoad] = useTransition();
  const [mutating, startMutate] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(() => {
    startLoad(async () => {
      const [keysRes, sumRes] = await Promise.all([
        listKeysStoreAction(),
        keysStoreUsageSummaryAction("30d"),
      ]);
      if (keysRes.ok) setItems(keysRes.data.items);
      else setItems([]);
      if (sumRes.ok) setSummary(sumRes.data);
      else setSummary(null);
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

      {/* ───────────────── 3. 총 사용량 게이지 ───────────────── */}
      <PanelCard title="총 사용량" description="최근 30일 — 등록된 모든 활성 키 합산">
        <UsageGauge summary={summary} />
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
function UsageGauge({ summary }: { summary: GeminiKeysStoreUsageSummary | null }) {
  if (!summary) {
    return <div className="text-sm text-muted">사용량 데이터를 불러올 수 없습니다.</div>;
  }
  const tokens = summary.totals.tokens;
  const cap = summary.totals.cap;
  const pct = summary.totals.percentOfCap;
  const capConfigured = cap != null && cap > 0 && pct != null;
  const fillPct = capConfigured ? Math.max(0, Math.min(100, pct as number)) : 0;
  const barColor =
    !capConfigured
      ? "bg-slate-300"
      : (pct as number) >= 95
        ? "bg-rose-500"
        : (pct as number) >= 80
          ? "bg-amber-500"
          : "bg-emerald-500";

  return (
    <div className="space-y-2">
      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full ${barColor} transition-[width] duration-500`}
          style={{ width: `${fillPct}%` }}
          aria-label="usage bar"
        />
      </div>
      <div className="text-sm text-slate-800 font-medium">
        {capConfigured
          ? `${formatM(tokens)} 토큰 / ${formatM(cap as number)} 캡 (${(pct as number).toFixed(1)}%)`
          : `${formatM(tokens)} 토큰 · 월 한도 미설정`}
      </div>
      <div className="text-xs text-muted">
        추정 비용 $
        {summary.totals.costUsd.toFixed(2)} · 활성 키 {summary.items.length}개
      </div>
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
