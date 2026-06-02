import type { ReactNode } from "react";
import { KpiSparkline } from "./KpiSparkline";

type Tone = "indigo" | "pink" | "teal" | "orange";
type IconName = "device" | "chat" | "alert" | "queue";

const TONE: Record<Tone, { bg: string; ring: string; text: string; accent: string }> = {
  indigo: { bg: "bg-indigo-50", ring: "ring-indigo-200", text: "text-indigo-700", accent: "#6366f1" },
  pink:   { bg: "bg-pink-50",   ring: "ring-pink-200",   text: "text-pink-700",   accent: "#ec4899" },
  teal:   { bg: "bg-teal-50",   ring: "ring-teal-200",   text: "text-teal-700",   accent: "#14b8a6" },
  orange: { bg: "bg-orange-50", ring: "ring-orange-200", text: "text-orange-700", accent: "#f97316" },
};

export function KpiChip({ label, value, sub, tone = "indigo", icon = "device", trend }: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
  icon?: IconName;
  /** 최근 7일 추세 — 있으면 카드 하단에 선+영역 sparkline 으로 표시. */
  trend?: number[];
}) {
  const t = TONE[tone];
  const hasTrend = Array.isArray(trend) && trend.length > 0;
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white border border-slate-200 px-4 py-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`h-12 w-12 shrink-0 rounded-full flex items-center justify-center ring-1 ${t.bg} ${t.ring} ${t.text}`}>
          <Glyph name={icon} className="w-5 h-5" />
        </div>
        <div className="min-w-0">
          <div className="text-[11px] text-muted truncate">{sub ?? label}</div>
          <div className="font-semibold text-slate-900 truncate text-sm">{label}</div>
          <div className="text-lg font-bold tracking-tight text-slate-900">{value}</div>
        </div>
      </div>
      {/* 카드 하단 7일 변화량 (선 + area fill). 데이터 없으면 영역 미표시. */}
      {hasTrend ? (
        <div className="mt-1 -mx-1">
          <KpiSparkline values={trend} accent={t.accent} width={240} height={44} />
          <div className="px-1 text-[9px] text-slate-400 leading-none">최근 7일</div>
        </div>
      ) : null}
    </div>
  );
}

function Glyph({ name, className }: { name: IconName; className?: string }): ReactNode {
  switch (name) {
    case "device":
      return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><rect x="6" y="3" width="12" height="18" rx="2"/><path d="M10 18h4"/></svg>;
    case "chat":
      return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a8 8 0 1 1-3-6.2L21 5l-1 4.5A8 8 0 0 1 21 12z"/></svg>;
    case "alert":
      return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5M12 18v.5"/></svg>;
    case "queue":
      return <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h10"/></svg>;
  }
}
