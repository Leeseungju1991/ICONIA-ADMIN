"use client";

// 2026-06-17 (BYOK 가시성 라운드) — 사용자 본인 키(BYOK) Gemini 호출 집계 페이지.
//   /dashboard/byok-usage
//
// 표시: 기간 선택 (7d / 30d / 90d), 사용자별 BYOK 호출 횟수 / 토큰 / 비용 추정 / 마지막 호출.
// 데이터 출처: GET /api/v1/admin/gemini/byok-usage (adminGeminiRoutes.js).
//   서버는 GeminiKeyUsage 테이블에서 byok=true + user_id IS NOT NULL row 를 groupBy(user_id).

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { EmptyState, ErrorState, LoadingState } from "../_components/CardStates";
import {
  fetchByokUsageAction,
  type ByokUsageItem,
  type ByokUsageResponse,
} from "@/lib/actions/gemini";

type Range = "7d" | "30d" | "90d";
const RANGE_DAYS: Record<Range, number> = { "7d": 7, "30d": 30, "90d": 90 };

function rangeWindow(range: Range): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}

function formatUsd(v: number): string {
  if (!Number.isFinite(v) || v <= 0) return "$0";
  if (v < 0.01) return "<$0.01";
  return `$${v.toFixed(2)}`;
}

function formatTs(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("ko-KR", { hour12: false });
  } catch {
    return iso;
  }
}

export default function ByokUsagePage() {
  const [range, setRange] = useState<Range>("30d");
  const [resp, setResp] = useState<ByokUsageResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  function reload(r: Range) {
    startLoad(async () => {
      const win = rangeWindow(r);
      const res = await fetchByokUsageAction({ ...win, limit: 200 });
      if (res.ok) {
        setResp(res.data);
        setError(null);
      } else {
        setError(res.message);
        setResp(null);
      }
    });
  }

  useEffect(() => {
    reload(range);
  }, [range]);

  const totals = useMemo(() => {
    if (!resp) return { calls: 0, prompt: 0, completion: 0, cost: 0 };
    return resp.items.reduce(
      (acc, it) => ({
        calls: acc.calls + it.byok_calls,
        prompt: acc.prompt + it.prompt_tokens,
        completion: acc.completion + it.completion_tokens,
        cost: acc.cost + it.cost_estimate_usd,
      }),
      { calls: 0, prompt: 0, completion: 0, cost: 0 },
    );
  }, [resp]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-slate-900">BYOK 사용량</h1>
          <p className="text-xs text-muted mt-0.5">
            사용자 본인 Gemini API 키로 발생한 호출 집계. 사용량은 사용자의 Google Cloud quota 에서 차감되며 본 표는 추적 목적입니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {(Object.keys(RANGE_DAYS) as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${
                range === r
                  ? "bg-slate-900 text-white border-slate-900"
                  : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </header>

      {/* 합계 카드 */}
      <PanelCard title="기간 합계" description={`${range} (사용자 기준 정렬: 비용 추정 ↓)`}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="활성 사용자" value={String(resp?.total ?? 0)} />
          <Stat label="호출 횟수" value={totals.calls.toLocaleString("en-US")} />
          <Stat
            label="토큰 (in/out)"
            value={`${totals.prompt.toLocaleString("en-US")} / ${totals.completion.toLocaleString("en-US")}`}
          />
          <Stat label="비용 추정" value={formatUsd(totals.cost)} />
        </div>
      </PanelCard>

      {/* 상세 테이블 */}
      <PanelCard title="사용자별 BYOK 호출" description="호출자가 본인 키로 호출한 사용량. 운영자 quota 영향 없음.">
        {loading ? (
          <LoadingState label="불러오는 중…" />
        ) : error ? (
          <ErrorState message={error} onRetry={() => reload(range)} />
        ) : !resp || resp.items.length === 0 ? (
          <EmptyState
            title="해당 기간 BYOK 호출이 없습니다"
            hint="사용자가 본인 API 키를 등록하면 본 표에 집계됩니다."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-slate-200">
                  <th className="text-left py-2 px-3 font-medium">user_id</th>
                  <th className="text-right py-2 px-3 font-medium">호출</th>
                  <th className="text-right py-2 px-3 font-medium">prompt</th>
                  <th className="text-right py-2 px-3 font-medium">completion</th>
                  <th className="text-right py-2 px-3 font-medium">비용 추정</th>
                  <th className="text-left py-2 px-3 font-medium">마지막 호출</th>
                </tr>
              </thead>
              <tbody>
                {resp.items.map((it: ByokUsageItem) => (
                  <tr key={it.user_id} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 px-3 font-mono text-xs text-slate-700">{it.user_id}</td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {it.byok_calls.toLocaleString("en-US")}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {it.prompt_tokens.toLocaleString("en-US")}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums">
                      {it.completion_tokens.toLocaleString("en-US")}
                    </td>
                    <td className="py-2 px-3 text-right tabular-nums font-medium">
                      {formatUsd(it.cost_estimate_usd)}
                    </td>
                    <td className="py-2 px-3 text-xs text-muted">{formatTs(it.last_ts)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="mt-1 text-lg font-semibold text-slate-900 tabular-nums">{value}</div>
    </div>
  );
}
