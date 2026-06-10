// 2026-05-27 — 어드민 단일 그래프 라이브러리 (SVG 자체구현).
//
// 외부 라이브러리(recharts/echarts) 미설치 + Next 14 + Stitch 톤. SVG 한 파일로
// 일관된 라인/스파크라인/도넛/막대 4종을 만들어 모든 그래프가 동일 톤을 갖게 한다.
// 모든 차트는 prop `accent` (tailwind color) + `data` 만 받는다.

type Point = { x: string | number; y: number };

export function LineChart({
  data,
  accent = "#6D5DFE",
  height = 180,
  yLabel,
  format = (n) => n.toLocaleString(),
}: {
  data: Point[];
  accent?: string;
  height?: number;
  yLabel?: string;
  format?: (n: number) => string;
}) {
  if (!data || data.length === 0) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-center text-xs text-slate-500"
        style={{ height }}
      >
        시계열 데이터 없음
      </div>
    );
  }
  const padding = { top: 16, right: 12, bottom: 24, left: 40 };
  const width = 600;
  const maxY = Math.max(1, ...data.map((d) => d.y));
  const minY = 0;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const step = data.length > 1 ? innerW / (data.length - 1) : 0;
  const points = data.map((d, i) => {
    const x = padding.left + step * i;
    const y =
      padding.top + innerH - ((d.y - minY) / (maxY - minY || 1)) * innerH;
    return { x, y, raw: d };
  });
  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  const areaPath =
    points.length > 0
      ? `${linePath} L ${points[points.length - 1].x} ${padding.top + innerH} L ${padding.left} ${padding.top + innerH} Z`
      : "";

  // 4 horizontal grid lines.
  const gridYs = [0, 0.25, 0.5, 0.75, 1].map((p) => padding.top + innerH * p);

  return (
    <div className="w-full">
      {yLabel ? <div className="text-[11px] text-slate-500 mb-1">{yLabel}</div> : null}
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
        {gridYs.map((y) => (
          <line
            key={y}
            x1={padding.left}
            x2={width - padding.right}
            y1={y}
            y2={y}
            stroke="#E5E7EB"
            strokeWidth={1}
          />
        ))}
        {/* Y 축 라벨 (max / 0). */}
        <text x={padding.left - 6} y={padding.top + 4} fontSize={10} fill="#94A3B8" textAnchor="end">
          {format(maxY)}
        </text>
        <text x={padding.left - 6} y={padding.top + innerH} fontSize={10} fill="#94A3B8" textAnchor="end">
          0
        </text>
        <path d={areaPath} fill={accent} opacity={0.12} />
        <path d={linePath} fill="none" stroke={accent} strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={accent}>
            <title>
              {String(p.raw.x)} — {format(p.raw.y)}
            </title>
          </circle>
        ))}
      </svg>
    </div>
  );
}

export function ProgressBar({
  ratio,
  tone = "ok",
  label,
}: {
  ratio: number;
  tone?: "ok" | "warn" | "critical";
  label?: string;
}) {
  const pct = Math.round(Math.min(Math.max(ratio, 0), 1) * 100);
  const bg =
    tone === "critical"
      ? "bg-rose-500"
      : tone === "warn"
        ? "bg-amber-500"
        : "bg-accent";
  return (
    <div className="w-full">
      {label ? <div className="text-[11px] text-slate-500 mb-1">{label}</div> : null}
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-[11px] font-mono text-slate-600">{pct}%</div>
    </div>
  );
}

export function Donut({
  segments,
  size = 120,
  thickness = 18,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          cx={c}
          cy={c}
          r={radius}
          fill="none"
          stroke="#E5E7EB"
          strokeWidth={thickness}
        />
        {segments.map((seg) => {
          const len = (seg.value / total) * circumference;
          const dasharray = `${len} ${circumference - len}`;
          const dashoffset = -offset;
          offset += len;
          return (
            <circle
              key={seg.label}
              cx={c}
              cy={c}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
              transform={`rotate(-90 ${c} ${c})`}
            />
          );
        })}
      </svg>
      <ul className="space-y-1 text-xs">
        {segments.map((s) => (
          <li key={s.label} className="flex items-center gap-2">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ background: s.color }}
              aria-hidden
            />
            <span className="text-slate-700">{s.label}</span>
            <span className="font-mono text-slate-500">
              {((s.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function BarChart({
  data,
  accent = "#6D5DFE",
  height = 160,
  format = (n) => n.toLocaleString(),
  showValues = false,
}: {
  data: Array<{ label: string; value: number }>;
  accent?: string;
  height?: number;
  format?: (n: number) => string;
  /** 막대마다 값 라벨을 함께 표시. tall 막대는 안쪽, short 막대는 위쪽에. */
  showValues?: boolean;
}) {
  if (!data || data.length === 0) {
    return (
      <div
        className="rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-center text-xs text-slate-500"
        style={{ height }}
      >
        데이터 없음
      </div>
    );
  }
  const maxV = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className="w-full" style={{ height }}>
      <div className="flex items-end gap-2 h-[calc(100%-22px)]">
        {data.map((d) => {
          const heightPct = (d.value / maxV) * 100;
          const tall = heightPct >= 25;
          return (
            <div key={d.label} className="flex-1 flex flex-col items-center justify-end h-full">
              {showValues && !tall ? (
                <div className="text-[10px] font-mono text-slate-700 leading-none mb-0.5">
                  {format(d.value)}
                </div>
              ) : null}
              <div
                className="w-full rounded-t-md flex items-start justify-center"
                style={{
                  height: `${heightPct}%`,
                  background: accent,
                  minHeight: 2,
                }}
                title={`${d.label}: ${format(d.value)}`}
              >
                {showValues && tall ? (
                  <span className="text-[10px] font-mono text-white/95 pt-1 leading-none">
                    {format(d.value)}
                  </span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-2 mt-1">
        {data.map((d) => (
          <div
            key={d.label}
            className="flex-1 text-[10px] text-slate-500 text-center truncate"
            title={d.label}
          >
            {d.label}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Sparkline({
  values,
  accent = "#6D5DFE",
  width = 80,
  height = 28,
}: {
  values: number[];
  accent?: string;
  width?: number;
  height?: number;
}) {
  if (!values || values.length === 0) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }
  const max = Math.max(1, ...values);
  const step = values.length > 1 ? width / (values.length - 1) : 0;
  const points = values
    .map((v, i) => `${i * step},${height - (v / max) * height}`)
    .join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <polyline points={points} fill="none" stroke={accent} strokeWidth={1.5} />
    </svg>
  );
}
