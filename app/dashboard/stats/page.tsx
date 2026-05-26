"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import {
  mockStatsTimeseries,
  mockUserPerceivedErrorRate,
  USER_PERCEIVED_ERROR_SLO_TARGET,
} from "@/lib/mockData";
import { getAiHealthAction } from "@/lib/actions/aiHealth";
import type { AiHealthSnapshot } from "@/lib/adminApi";

type Metric = "dau" | "signups" | "revenue";

// 한 단계 옅은 톤(*-400 계열)으로 정합 — 진한 *-500 hex 가 막대를 투박하게 보이게 함.
const metricInfo: Record<Metric, { label: string; format: (n: number) => string; color: string }> = {
  dau: { label: "DAU", format: (n) => n.toLocaleString(), color: "#818CF8" }, // indigo-400
  signups: { label: "신규 가입", format: (n) => n.toLocaleString(), color: "#F472B6" }, // pink-400
  revenue: { label: "매출", format: (n) => "₩" + (n / 1000).toFixed(0) + "k", color: "#FB923C" }, // orange-400
};

export default function StatsPage() {
  const [metric, setMetric] = useState<Metric>("dau");

  const stats = useMemo(() => {
    const series = mockStatsTimeseries;
    const total = series.reduce((s, d) => s + d[metric], 0);
    const last = series[series.length - 1][metric];
    const prev = series[series.length - 2][metric];
    const delta = ((last - prev) / prev) * 100;
    const avg = total / series.length;
    return { total, last, delta, avg };
  }, [metric]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="DAU (오늘)" value={mockStatsTimeseries.at(-1)!.dau.toLocaleString()} delta="+4.2%" deltaTone="up" hint="전일 대비" accent="blue" />
        <StatCard label="신규 가입 (오늘)" value={mockStatsTimeseries.at(-1)!.signups.toLocaleString()} delta="+21.5%" deltaTone="up" hint="전일 대비" accent="pink" />
        <StatCard label="매출 (오늘)" value={"₩ " + mockStatsTimeseries.at(-1)!.revenue.toLocaleString()} delta="+1.8%" deltaTone="up" hint="전일 대비" accent="orange" />
        <StatCard label="결제 전환율" value="3.8%" delta="+0.4%p" deltaTone="up" hint="7일 평균" accent="teal" />
      </section>

      <CostDashboardPanel />

      <PanelCard
        title="7일 추세"
        description="DAU·신규 가입·매출의 일별 변화"
        actions={
          <div className="flex gap-1 p-1 rounded-full bg-white/60 border border-white/60">
            {(Object.keys(metricInfo) as Metric[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMetric(m)}
                className={[
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  metric === m ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-white/70",
                ].join(" ")}
              >
                {metricInfo[m].label}
              </button>
            ))}
          </div>
        }
      >
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
          <div className="rounded-2xl bg-white/55 border border-white/60 p-3">
            <div className="text-[11px] text-muted">{metricInfo[metric].label} 합계</div>
            <div className="text-lg font-bold text-slate-800 mt-1">{metricInfo[metric].format(stats.total)}</div>
          </div>
          <div className="rounded-2xl bg-white/55 border border-white/60 p-3">
            <div className="text-[11px] text-muted">평균</div>
            <div className="text-lg font-bold text-slate-800 mt-1">{metricInfo[metric].format(Math.round(stats.avg))}</div>
          </div>
          <div className="rounded-2xl bg-white/55 border border-white/60 p-3">
            <div className="text-[11px] text-muted">오늘</div>
            <div className="text-lg font-bold text-slate-800 mt-1">{metricInfo[metric].format(stats.last)}</div>
          </div>
          <div className="rounded-2xl bg-white/55 border border-white/60 p-3">
            <div className="text-[11px] text-muted">전일 대비</div>
            <div className={"text-lg font-bold mt-1 " + (stats.delta >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {stats.delta >= 0 ? "+" : ""}{stats.delta.toFixed(1)}%
            </div>
          </div>
        </div>

        <BarChart metric={metric} />
      </PanelCard>

      <UserPerceivedErrorSloCard />

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PanelCard title="플랫폼 비중">
          <div className="space-y-3">
            {[
              { label: "iOS", value: 56, color: "bg-accentBlue" },
              { label: "Android", value: 38, color: "bg-accentPink" },
              { label: "Web", value: 6, color: "bg-accentTeal" },
            ].map((p) => (
              <div key={p.label}>
                <div className="flex justify-between text-xs text-slate-700">
                  <span className="font-medium">{p.label}</span>
                  <span>{p.value}%</span>
                </div>
                <div className="mt-1 h-2 rounded-full bg-white/60 overflow-hidden">
                  <div className={`h-full ${p.color}`} style={{ width: `${p.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </PanelCard>

        <PanelCard title="요금제 분포">
          <div className="grid grid-cols-3 gap-3 text-center">
            {[
              { label: "무료", value: "8,420", percent: "65.6%", tone: "blue" as const },
              { label: "스탠다드", value: "3,210", percent: "25.0%", tone: "pink" as const },
              { label: "프리미엄", value: "1,210", percent: "9.4%", tone: "orange" as const },
            ].map((p) => (
              <div key={p.label} className="rounded-2xl bg-white/55 border border-white/60 p-4">
                <div className="text-xs text-muted">{p.label}</div>
                <div className="text-xl font-bold text-slate-900 mt-1">{p.value}</div>
                <div className="text-[11px] text-muted mt-0.5">{p.percent}</div>
              </div>
            ))}
          </div>
        </PanelCard>
      </section>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────
// SLO: 사용자 인지된 에러율
//
// Admin 운영자가 "최종 사용자 측 UX 가 얼마나 망가져 있는가" 를 한 눈에 보는
// 읽기-전용 카드. 정책 (Router → Admin 라운드 2):
//   - 분자: visible (사용자가 명확히 에러로 인지한 건수)
//   - 분모: total_errors
//   - 목표: ≤ 1.5% (USER_PERCEIVED_ERROR_SLO_TARGET)
//
// in-character / silent 도 분포로 함께 보여 카탈로그 정책이 잘 흡수하고 있는지
// (= 운영자가 SLO 를 무리 없이 지키는지) 시각적으로 확인.
function UserPerceivedErrorSloCard() {
  const series = mockUserPerceivedErrorRate;
  const today = series[series.length - 1];
  const todayRate = today.total_errors > 0 ? today.user_visible / today.total_errors : 0;
  const sevenDayTotal = series.reduce((s, p) => s + p.total_errors, 0);
  const sevenDayVisible = series.reduce((s, p) => s + p.user_visible, 0);
  const sevenDayRate = sevenDayTotal > 0 ? sevenDayVisible / sevenDayTotal : 0;
  const target = USER_PERCEIVED_ERROR_SLO_TARGET;
  const meetingSlo = sevenDayRate <= target;

  // 분포 (오늘 기준) — visible / in-character / silent
  const distribution: Array<{ label: string; value: number; color: string; meta: string }> = [
    {
      label: "사용자 인지 (visible)",
      value: today.user_visible,
      color: "bg-rose-400",
      meta: "명확한 에러 UI 노출",
    },
    {
      label: "캐릭터 라인 완충 (in-character)",
      value: today.in_character,
      color: "bg-sky-300",
      meta: "AI 가 자연어로 우회 표현",
    },
    {
      label: "사용자 인지 없음 (silent)",
      value: today.silent,
      color: "bg-emerald-300",
      meta: "백그라운드 처리 / 자동 재시도",
    },
  ];

  return (
    <PanelCard
      title="SLO — 사용자 인지된 에러율"
      description={`최종 사용자가 명확히 에러로 인지한 비율. 목표 ≤ ${(target * 100).toFixed(1)}%. (mock — 백엔드 미연동)`}
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-5">
        <div className="rounded-2xl bg-white/55 border border-white/60 p-3">
          <div className="text-[11px] text-muted">오늘 인지율</div>
          <div className={"text-lg font-bold mt-1 " + (todayRate <= target ? "text-emerald-600" : "text-rose-600")}>
            {(todayRate * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] text-muted">{today.user_visible.toLocaleString()} / {today.total_errors.toLocaleString()}</div>
        </div>
        <div className="rounded-2xl bg-white/55 border border-white/60 p-3">
          <div className="text-[11px] text-muted">7일 평균</div>
          <div className={"text-lg font-bold mt-1 " + (meetingSlo ? "text-emerald-600" : "text-rose-600")}>
            {(sevenDayRate * 100).toFixed(2)}%
          </div>
          <div className="text-[11px] text-muted">
            {sevenDayVisible.toLocaleString()} / {sevenDayTotal.toLocaleString()}
          </div>
        </div>
        <div className="rounded-2xl bg-white/55 border border-white/60 p-3">
          <div className="text-[11px] text-muted">목표선</div>
          <div className="text-lg font-bold text-slate-800 mt-1">{(target * 100).toFixed(1)}%</div>
          <div className="text-[11px] text-muted">운영자 OKR</div>
        </div>
        <div className="rounded-2xl bg-white/55 border border-white/60 p-3">
          <div className="text-[11px] text-muted">SLO 상태</div>
          <div className={"text-lg font-bold mt-1 " + (meetingSlo ? "text-emerald-600" : "text-rose-600")}>
            {meetingSlo ? "충족" : "위반"}
          </div>
          <div className="text-[11px] text-muted">{meetingSlo ? "목표 이내" : "목표 초과"}</div>
        </div>
      </div>

      <div className="rounded-2xl bg-white/55 border border-white/60 p-4">
        {/* 차트 영역 — 옅은 가로 grid line 5선(0/25/50/75/100%) 위에 막대 렌더. */}
        <div className="relative h-40">
          <ChartGridLines />
          <div className="relative flex items-end gap-3 h-full">
            {series.map((p) => {
              const max = Math.max(...series.map((q) => q.total_errors));
              const totalPct = (p.total_errors / max) * 100;
              const dayRate = p.total_errors > 0 ? p.user_visible / p.total_errors : 0;
              // 막대 안에서 visible/in-char/silent 의 상대 비율 (합 = 100%).
              const visiblePct = p.total_errors > 0 ? (p.user_visible / p.total_errors) * 100 : 0;
              const inCharPct = p.total_errors > 0 ? (p.in_character / p.total_errors) * 100 : 0;
              const silentPct = p.total_errors > 0 ? (p.silent / p.total_errors) * 100 : 0;
              return (
                <div
                  key={p.day}
                  className="flex-1 flex flex-col-reverse rounded-t-lg overflow-hidden border border-white/60"
                  style={{ height: `${totalPct}%` }}
                >
                  <div
                    className="w-full bg-emerald-300/75"
                    style={{ height: `${silentPct}%` }}
                    title={`silent: ${p.silent.toLocaleString()}`}
                  />
                  <div
                    className="w-full bg-sky-300/75"
                    style={{ height: `${inCharPct}%` }}
                    title={`in-character: ${p.in_character.toLocaleString()}`}
                  />
                  <div
                    className="w-full bg-rose-400/75"
                    style={{ height: `${visiblePct}%` }}
                    title={`visible: ${p.user_visible.toLocaleString()} (${(dayRate * 100).toFixed(2)}%)`}
                  />
                </div>
              );
            })}
          </div>
        </div>
        {/* 라벨 영역 — day + 일별 인지율 */}
        <div className="mt-2 flex gap-3">
          {series.map((p) => {
            const dayRate = p.total_errors > 0 ? p.user_visible / p.total_errors : 0;
            return (
              <div key={p.day} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-muted">{p.day}</div>
                <div
                  className={
                    "text-[10px] font-semibold " +
                    (dayRate <= target ? "text-emerald-600" : "text-rose-600")
                  }
                >
                  {(dayRate * 100).toFixed(2)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        {distribution.map((d) => (
          <div key={d.label} className="rounded-2xl bg-white/55 border border-white/60 p-3">
            <div className="flex items-center gap-2">
              <span className={`inline-block w-3 h-3 rounded-sm ${d.color}`} />
              <span className="text-xs font-medium text-slate-700">{d.label}</span>
            </div>
            <div className="text-lg font-bold text-slate-900 mt-1">{d.value.toLocaleString()}</div>
            <div className="text-[11px] text-muted">{d.meta}</div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted mt-3">
        ※ 분류는 `lib/errorCatalog.ts` 의 `userVisibility` 필드 기반. 백엔드 연동 시
        `/api/v1/admin/error-slo` 시계열로 교체. (현재 mock)
      </p>
    </PanelCard>
  );
}

// 옅은 가로 grid line — 차트 영역에 0/25/50/75/100% 5선 절대 배치.
// 시각적 reference 만 제공하고 막대 hit-test 는 방해하지 않는다.
function ChartGridLines() {
  return (
    <div
      className="absolute inset-0 pointer-events-none flex flex-col justify-between"
      aria-hidden="true"
    >
      <div className="border-t border-slate-200/80" />
      <div className="border-t border-slate-200/50" />
      <div className="border-t border-slate-200/50" />
      <div className="border-t border-slate-200/50" />
      <div className="border-t border-slate-200/80" />
    </div>
  );
}

function BarChart({ metric }: { metric: Metric }) {
  const series = mockStatsTimeseries;
  const max = Math.max(...series.map((d) => d[metric]));
  return (
    <div className="rounded-2xl bg-white/55 border border-white/60 p-4">
      {/* 차트 영역 — 옅은 가로선 위에 막대 */}
      <div className="relative h-48">
        <ChartGridLines />
        <div className="relative flex items-end gap-3 h-full">
          {series.map((d) => {
            const h = (d[metric] / max) * 100;
            return (
              <div
                key={d.day}
                className="flex-1 rounded-t-lg"
                style={{
                  height: `${h}%`,
                  // 상단 ~75%(BF) → 하단 ~20%(33) — 위에서 아래로 더 부드럽게 페이드.
                  background: `linear-gradient(180deg, ${metricInfo[metric].color}BF 0%, ${metricInfo[metric].color}33 100%)`,
                }}
                title={metricInfo[metric].format(d[metric])}
              />
            );
          })}
        </div>
      </div>
      {/* 라벨 영역 — day */}
      <div className="mt-2 flex gap-3">
        {series.map((d) => (
          <div key={d.day} className="flex-1 text-center text-[10px] text-muted">
            {d.day}
          </div>
        ))}
      </div>
    </div>
  );
}

// V2.0 #17 — Server `/api/v1/admin/ai-health` 의 cost 차원을 Admin 으로 가시화.
// AI metricsBuffer (cost_usd_sum) → Server aiHealthTracker.snapshot().cost → 본 패널.
function CostDashboardPanel() {
  const [snap, setSnap] = useState<AiHealthSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getAiHealthAction()
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(r.message);
        } else {
          setSnap(r.snapshot);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <PanelCard title="AI 비용">
        <div className="text-sm text-muted">불러오는 중</div>
      </PanelCard>
    );
  }
  if (error || !snap) {
    return (
      <PanelCard title="AI 비용">
        <div className="text-sm text-muted">집계된 비용이 없습니다.</div>
      </PanelCard>
    );
  }
  const cost = snap.cost;
  if (!cost) {
    return (
      <PanelCard title="AI 비용">
        <div className="text-sm text-muted">집계된 비용이 없습니다.</div>
      </PanelCard>
    );
  }
  return (
    <PanelCard
      title={`AI 비용 — $${cost.total_usd.toFixed(4)} / ₩${Math.round(cost.total_krw).toLocaleString()}`}
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <div className="text-xs text-muted mb-2">응답 종류별 (text / voice / vision)</div>
          {cost.by_kind ? (
            <ul className="space-y-1 text-xs">
              {(["text", "voice", "vision"] as const).map((k) =>
                cost.by_kind && cost.by_kind[k] ? (
                  <li
                    key={k}
                    className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 flex items-center justify-between"
                  >
                    <span className="uppercase font-semibold">{k}</span>
                    <span>
                      ${cost.by_kind[k].usd.toFixed(4)} · ₩
                      {Math.round(cost.by_kind[k].krw).toLocaleString()}
                    </span>
                  </li>
                ) : null,
              )}
            </ul>
          ) : (
            <div className="text-xs text-muted">분면 데이터 없음</div>
          )}
        </div>
        <div>
          <div className="text-xs text-muted mb-2">모델별 (Flash / Pro / cached)</div>
          {cost.by_model && Object.keys(cost.by_model).length > 0 ? (
            <ul className="space-y-1 text-xs">
              {Object.entries(cost.by_model).map(([model, c]) => (
                <li
                  key={model}
                  className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 flex items-center justify-between"
                >
                  <span className="font-mono">{model}</span>
                  <span>
                    ${c.usd.toFixed(4)} · {c.calls.toLocaleString()}회
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-xs text-muted">모델 호출 없음</div>
          )}
        </div>
      </div>
    </PanelCard>
  );
}
