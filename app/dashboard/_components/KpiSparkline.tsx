// 2026-06-02 — KPI 카드 하단 7일 변화량 sparkline (선 + area fill).
//
// 기존 SimpleChart.Sparkline 은 선만 그리는 mini 그래프지만, 대시보드 4-KPI 카드
// (활성 디바이스 / DAU / 신고 대기 / 큐 적체) 에서는 "선 + 그래프 내부 연한 색"
// 으로 영역 표현이 필요하므로 별도 컴포넌트로 분리한다.
//
// 입력 데이터는 server overview.trend_7d 정본을 그대로 받음(oldest→newest 7개).
// 누락/이상치(NaN/Infinity)는 0 으로 보정해 SVG path 가 깨지지 않도록 방어한다.
// 마지막 데이터 포인트(현재값)에 작은 dot 강조로 "최신 = 어디" 를 시각화.

export function KpiSparkline({
  values,
  accent = "#6366f1",
  width = 100,
  height = 44,
}: {
  /** 최근 N일(보통 7) 값 배열 — oldest→newest. */
  values: number[];
  /** 선/영역 색상. KpiChip TONE 의 accent hex 와 동일. */
  accent?: string;
  width?: number;
  height?: number;
}) {
  // 방어: 비어있거나 단일 포인트면 점만 표시(line 그릴 수 없음).
  if (!values || values.length === 0) {
    return <span className="text-[10px] text-slate-400">—</span>;
  }

  // NaN/Infinity 방어 — finite 가 아닌 값은 0 으로 치환.
  const safe = values.map((v) => (Number.isFinite(v) ? v : 0));

  // padding 을 두어 stroke 가 SVG 가장자리에서 잘리지 않도록.
  const pad = { top: 3, right: 3, bottom: 3, left: 3 };
  const innerW = Math.max(1, width - pad.left - pad.right);
  const innerH = Math.max(1, height - pad.top - pad.bottom);

  const max = Math.max(...safe);
  const min = Math.min(...safe);
  const range = max - min || 1; // 0-divide 방어 (전부 동일 값일 때 평평한 선).

  const step = safe.length > 1 ? innerW / (safe.length - 1) : 0;
  const points = safe.map((v, i) => {
    const x = pad.left + step * i;
    // 위→아래 flip: 최댓값이 위, 최솟값이 아래.
    const y = pad.top + innerH - ((v - min) / range) * innerH;
    return { x, y };
  });

  // 단일 포인트면 중앙에 dot 만 표시.
  if (points.length === 1) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <circle cx={width / 2} cy={height / 2} r={2.5} fill={accent} />
      </svg>
    );
  }

  const linePath = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(" ");
  // 영역 path: 라인 끝 → 우하단 → 좌하단 → close.
  const baseline = pad.top + innerH;
  const areaPath = `${linePath} L ${points[points.length - 1].x} ${baseline} L ${points[0].x} ${baseline} Z`;

  const last = points[points.length - 1];

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label="최근 7일 변화량"
      className="block"
    >
      {/* area fill — accent 색을 12% 불투명도로 (연한 색 요구사항). */}
      <path d={areaPath} fill={accent} opacity={0.12} />
      {/* line stroke — 본선. */}
      <path
        d={linePath}
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 마지막 포인트 강조 — 현재값 dot. */}
      <circle cx={last.x} cy={last.y} r={2.2} fill={accent} />
    </svg>
  );
}
