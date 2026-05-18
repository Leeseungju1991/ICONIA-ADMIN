"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import { mockStatsTimeseries } from "@/lib/mockData";

type Metric = "dau" | "signups" | "revenue";

const metricInfo: Record<Metric, { label: string; format: (n: number) => string; color: string }> = {
  dau: { label: "DAU", format: (n) => n.toLocaleString(), color: "#6D5DFE" },
  signups: { label: "신규 가입", format: (n) => n.toLocaleString(), color: "#EC4899" },
  revenue: { label: "매출", format: (n) => "₩" + (n / 1000).toFixed(0) + "k", color: "#F97316" },
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

function BarChart({ metric }: { metric: Metric }) {
  const series = mockStatsTimeseries;
  const max = Math.max(...series.map((d) => d[metric]));
  return (
    <div className="rounded-2xl bg-white/55 border border-white/60 p-4">
      <div className="flex items-end gap-3 h-48">
        {series.map((d) => {
          const h = (d[metric] / max) * 100;
          return (
            <div key={d.day} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex-1 flex items-end">
                <div
                  className="w-full rounded-t-lg"
                  style={{
                    height: `${h}%`,
                    background: `linear-gradient(180deg, ${metricInfo[metric].color}E6 0%, ${metricInfo[metric].color}66 100%)`,
                  }}
                  title={metricInfo[metric].format(d[metric])}
                />
              </div>
              <div className="text-[10px] text-muted">{d.day}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
