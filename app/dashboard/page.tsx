import Link from "next/link";
import { PanelCard } from "./_components/PanelCard";
import { ForbiddenNotice } from "./_components/ForbiddenNotice";
import { KpiChip } from "./_components/KpiChip";
import { BarChart } from "./_components/SimpleChart";
import { keysStoreUsageSummaryAction } from "@/lib/actions/geminiKeysStore";
import { listReportsAction } from "@/lib/actions/reportsAdmin";
import { listErrorsAction } from "@/lib/actions/errorsTracking";
import { listLostReportsAction } from "@/lib/actions/lostReports";
import { fetchAdminOverviewAction } from "@/lib/actions/overview";
import type { ErrorDomain } from "@/types/admin-api";
import type { LostReportStatus } from "@/lib/adminApi";

export const dynamic = "force-dynamic";

// 2026-06-01 정본화: 운영자 요청으로 대시보드 home 을 핵심 KPI + Gemini 사용량 두 섹션으로 압축.
// - 신고 대기 강조 배너 + 3-KPI chip(활성 디바이스/DAU/오류 추적 이벤트) + 오류 추적
//   24h 분포 패널 + API 사용량 패널 4개 섹션.
// - 모든 값은 Server `/api/v1/admin/overview` + `/api/v1/admin/errors/*` 정본만 표시.
//   미응답 시 "—" 무음 표시.
// 2026-06-09 — 사용자 요청 3종:
//   (1) 3-box KPI 마지막 칸: 신고 대기 → 오류 추적 이벤트 개수 (errorEventsTotal,
//       /dashboard/error-tracking 으로 클릭 이동).
//   (2) 오류 추적 차트: count_24h/sample_count 둘 다 null 일 때 row 당 1로 폴백
//       (이벤트 row 가 있는데 sum=0 으로 그래프가 빈 화면 되던 회귀 fix).
//   (3) API 사용량 패널: per-key bar 리스트 제거, 4-stat (등록/활성화/비활성화/사용량%)
//       만 노출.

export default async function DashboardHome() {
  const overviewResult = await fetchAdminOverviewAction();
  const sv = overviewResult.ok ? overviewResult.data : null;

  const dash = sv
    ? {
        activeDevices: sv.active_devices,
        dauLabel: sv.dau.toLocaleString(),
        reportsPendingCount: sv.reports_pending,
        queueBacklog: sv.queue_depth,
      }
    : null;

  // 최근 7일 추세 — KPI 박스 sparkline 용 (server overview.trend_7d 정본).
  // TODO(server): SERVER /api/v1/admin/overview 가 trend_7d 미반환 시 아래 fixture
  // 로 대체. 향후 SERVER 가 정본을 내려주면 fallback 분기만 제거하면 된다.
  const trend = sv?.trend_7d ?? buildTrendFixture(sv);

  const DASH = (n: number | null | undefined): string =>
    n == null ? "—" : n.toLocaleString();

  // 2026-06-05 — 큐 적체 KPI 를 "오류 추적" 으로 교체. 4개 도메인 24h 이벤트 수 합계.
  //   각 도메인의 listErrorsAction 을 병렬 호출 후 e.count_24h ?? e.sample_count 누적.
  //   error-tracking 페이지의 stats.total 계산과 동일 로직.
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  // 2026-06-10 — 사용자 요청: 24h 분포 패널 하단에 7일 추세 그래프 추가.
  //   listErrorsAction 을 since=7d 로 재호출 후 last_seen_at 의 날짜 버킷별 집계.
  const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const ERROR_DOMAINS: ErrorDomain[] = ["firmware", "server", "ai", "app"];

  // 모더레이션 미해결 신고 카운트 + 4-도메인 24h 오류 합계 (KPI chip 용)
  //   + 4-도메인 7d 오류 row (트렌드 그래프용)
  //   + 등록 KEY 30일 사용량 요약 (오류 추적 이벤트 카드 푸터)
  //   + 분실/도난 신고 row (대시보드 하단 카드).
  // 2026-06-10 — API 사용량 패널 제거로 fetchGeminiKeysAction 호출 삭제.
  const [
    modRes,
    errorResults,
    errorResults7d,
    keysUsageRes,
    lostRes,
  ] = await Promise.all([
    listReportsAction({ status: "open" }),
    Promise.all(ERROR_DOMAINS.map((d) => listErrorsAction({ domain: d, since: since24h }))),
    Promise.all(ERROR_DOMAINS.map((d) => listErrorsAction({ domain: d, since: since7d }))),
    keysStoreUsageSummaryAction("30d"),
    listLostReportsAction({}),
  ]);
  // 신고 대기 강조 배너용 — overview.reports_pending 정본 + listReportsAction fallback.
  const reportsPendingDisplay =
    dash?.reportsPendingCount ?? (modRes.ok ? modRes.data.total_open : null);

  // 2026-06-05 — 오류 추적 차트(도메인별) + 라이프사이클 집계.
  //   KPI 칩(2차 라운드에서 제거됨)을 대체해 본 차트가 정본.
  // 2026-06-10 — 사용자 요청: 심각도 도넛 → 발생/조치/해결 3-타일로 교체.
  //   조치 = status ∈ { acknowledged, in_progress } (또는 acknowledged_at != null).
  //   해결 = status === "resolved" (또는 resolved_at != null).
  //   발생 = items 길이 합계 (row 1 = 이벤트 1).
  let anyErrorOk = false;
  const errorDomainCounts: Record<ErrorDomain, number> = {
    firmware: 0,
    server: 0,
    ai: 0,
    app: 0,
  };
  let lifecycleOccurred = 0;
  let lifecycleAcknowledged = 0;
  let lifecycleResolved = 0;
  errorResults.forEach((r, idx) => {
    if (!r.ok) return;
    anyErrorOk = true;
    const domain = ERROR_DOMAINS[idx];
    let domainSum = 0;
    for (const e of r.data.items) {
      // 2026-06-09 — fix: 서버 응답이 count_24h/sample_count 둘 다 누락이어도 row 자체가
      //   1건의 이벤트를 의미. 0으로 누적되어 그래프가 비어 보이던 회귀 해결.
      const ev = e.count_24h ?? e.sample_count ?? 1;
      domainSum += ev;
      lifecycleOccurred += 1;
      const status = e.status ?? null;
      if (status === "resolved" || e.resolved_at) {
        lifecycleResolved += 1;
      } else if (
        status === "acknowledged" ||
        status === "in_progress" ||
        e.acknowledged_at
      ) {
        lifecycleAcknowledged += 1;
      }
    }
    errorDomainCounts[domain] = domainSum;
  });
  const errorChartHasData =
    anyErrorOk &&
    Object.values(errorDomainCounts).some((v) => v > 0);
  // 2026-06-09 — 3-box KPI 마지막 칸 "오류 추적 이벤트" 용 24h 합계.
  const errorEventsTotal = anyErrorOk
    ? Object.values(errorDomainCounts).reduce((s, v) => s + v, 0)
    : null;

  // 2026-06-10 — 사용자 요청: "오류 추적 이벤트" 카드 푸터에 등록 KEY 30일 사용량 strip.
  //   keysStoreUsageSummaryAction("30d") 의 totals.tokens / totals.cap 사용. cap 미설정 시
  //   slate 톤으로 % 미표시.
  const keysUsage = keysUsageRes.ok ? keysUsageRes.data : null;
  const keysUsageTokens = keysUsage?.totals.tokens ?? 0;
  const keysUsageCap = keysUsage?.totals.cap ?? null;
  const keysUsagePctRaw = keysUsage?.totals.percentOfCap ?? null;
  const keysUsagePct =
    keysUsageCap != null && keysUsageCap > 0
      ? Number(((keysUsageTokens / keysUsageCap) * 100).toFixed(1))
      : keysUsagePctRaw != null
        ? Number(keysUsagePctRaw.toFixed(1))
        : null;
  const keysUsageTone =
    keysUsagePct == null
      ? "slate"
      : keysUsagePct >= 95
        ? "rose"
        : keysUsagePct >= 80
          ? "amber"
          : "emerald";

  // 2026-06-10 — 사용자 요청: 마지막 "API 사용량" 패널 → "인형 잃어버린 신고 접수" 로 교체.
  //   listLostReportsAction({}) 결과를 status 별로 client-side group.
  const lostItems = lostRes.ok ? lostRes.data.items : [];
  const lostStatusCounts: Record<LostReportStatus, number> = {
    pending: 0,
    in_progress: 0,
    resolved: 0,
    rejected: 0,
  };
  for (const r of lostItems) {
    if (lostStatusCounts[r.status] != null) lostStatusCounts[r.status] += 1;
  }
  const lostTotal = lostItems.length;

  // 2026-06-10 — 7일 추세 그래프 데이터. 4개 도메인 합산 후 last_seen_at 의 날짜
  //   (UTC) 로 버킷. count_24h/sample_count 누락 시 row 당 1 폴백 (24h 차트와 동일).
  //   오늘 포함 과거 7일 = 7 버킷. 가장 오래된 날짜가 왼쪽.
  const trend7dBuckets = (() => {
    const buckets: { date: string; label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const iso = d.toISOString().slice(0, 10); // YYYY-MM-DD
      const label = `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;
      buckets.push({ date: iso, label, value: 0 });
    }
    const idxByDate = new Map(buckets.map((b, i) => [b.date, i]));
    let any7dOk = false;
    errorResults7d.forEach((r) => {
      if (!r.ok) return;
      any7dOk = true;
      for (const e of r.data.items) {
        const ev = e.count_24h ?? e.sample_count ?? 1;
        const ls = e.last_seen_at;
        if (!ls) continue;
        const dayKey = ls.slice(0, 10);
        const bi = idxByDate.get(dayKey);
        if (bi != null) buckets[bi].value += ev;
      }
    });
    return { buckets, any7dOk };
  })();
  const trend7dHasData = trend7dBuckets.any7dOk && trend7dBuckets.buckets.some((b) => b.value > 0);

  return (
    <div className="space-y-5">
      <ForbiddenNotice />

      {/* 2026-06-01 — 신고 대기 강조 박스. 4-KPI 그리드 위에 큰 배너로 표시.
          클릭 시 신고 조치 페이지(/dashboard/reports)로 이동. */}
      <Link
        href="/dashboard/reports"
        className="block rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 px-4 py-4 sm:px-5 hover:border-rose-300 hover:shadow-card transition-all"
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="shrink-0 rounded-xl bg-rose-100 text-rose-700 px-3 py-2 text-xs font-semibold">
              신고 대기
            </div>
            <div className="min-w-0">
              <div className="text-2xl sm:text-3xl font-bold text-rose-900 leading-none">
                {DASH(reportsPendingDisplay)}
                <span className="ml-2 text-sm font-normal text-rose-700">건</span>
              </div>
              <div className="text-xs text-rose-700/80 mt-1">
                {reportsPendingDisplay && reportsPendingDisplay > 0
                  ? "검토가 필요한 신고가 있습니다. 클릭해서 조치 페이지로 이동."
                  : "현재 검토 대기 중인 신고가 없습니다."}
              </div>
            </div>
          </div>
          <div className="text-rose-700 text-sm font-medium whitespace-nowrap self-end sm:self-auto">
            신고 조치 →
          </div>
        </div>
      </Link>

      {/* 2026-06-09 — 사용자 요청: 마지막 KPI 박스 "신고 대기" → "오류 추적 이벤트".
          - 활성 디바이스 / DAU 두 칸 + 오류 추적 이벤트 (errorEventsTotal, 24h 합계).
          - 클릭 시 /dashboard/error-tracking 으로 이동. */}
      <section className="grid grid-cols-3 gap-0">
        <KpiChip
          tone="indigo"
          icon="device"
          label="활성 디바이스"
          value={DASH(dash?.activeDevices)}
          sub=""
          trend={trend?.active_devices}
        />
        <KpiChip
          tone="teal"
          icon="chat"
          label="DAU"
          value={dash?.dauLabel ?? "—"}
          sub=""
          trend={trend?.dau}
        />
        <Link
          href="/dashboard/error-tracking"
          className="block rounded-2xl hover:shadow-card transition"
          aria-label="오류 추적 이벤트로 이동"
        >
          <KpiChip
            tone="pink"
            icon="alert"
            label="오류 추적 이벤트"
            value={DASH(errorEventsTotal)}
            sub={
              errorEventsTotal == null
                ? "데이터 없음"
                : errorEventsTotal > 0
                  ? "24시간 합계"
                  : "정상"
            }
            footer={
              <GeminiUsageStrip
                tokens={keysUsageTokens}
                cap={keysUsageCap}
                pct={keysUsagePct}
                tone={keysUsageTone}
                available={keysUsageRes.ok}
              />
            }
          />
        </Link>
      </section>

      {/* 2026-06-05 — 오류 추적 차트 패널. KPI 칩(합계)과 error-tracking 페이지 사이의
          중간 가시화 — 도메인별 24h 막대 + 라이프사이클 3-타일 2분할.
          server `/api/v1/admin/errors/*` 정본의 listErrorsAction 4종 응답 재사용. */}
      {/* 2026-06-10 — 사용자 요청: 심각도 도넛 → 발생/조치/해결 3-타일로 교체. */}
      <PanelCard
        title="오류 추적 — 24h 분포"
        description="펌웨어 / 서버 / AI / 앱 도메인 24시간 이벤트 건수와 처리 라이프사이클입니다."
        actions={
          <Link href="/dashboard/error-tracking" className="btn-outline text-xs">
            자세히 →
          </Link>
        }
      >
        {!anyErrorOk ? (
          <div className="text-sm text-slate-500">
            오류 추적 데이터를 불러오지 못했습니다 (Server 미응답).
          </div>
        ) : !errorChartHasData ? (
          <div className="text-sm text-slate-500">
            최근 24시간 동안 기록된 오류 이벤트가 없습니다. (양호)
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <div className="text-xs text-slate-500 mb-2">도메인별 이벤트 수</div>
              <BarChart
                data={[
                  { label: `펌웨어 (${errorDomainCounts.firmware})`, value: errorDomainCounts.firmware },
                  { label: `서버 (${errorDomainCounts.server})`,     value: errorDomainCounts.server },
                  { label: `AI (${errorDomainCounts.ai})`,           value: errorDomainCounts.ai },
                  { label: `앱 (${errorDomainCounts.app})`,          value: errorDomainCounts.app },
                ]}
                accent="#EC4899"
                height={160}
              />
            </div>
            <div className="flex flex-col gap-2">
              <div className="text-xs text-slate-500">처리 라이프사이클</div>
              <LifecycleTile label="발생 건수" value={lifecycleOccurred} tone="critical" />
              <LifecycleTile label="조치 건수" value={lifecycleAcknowledged} tone="warn" />
              <LifecycleTile label="해결 건수" value={lifecycleResolved} tone="ok" />
            </div>
          </div>
        )}
      </PanelCard>

      {/* 2026-06-10 — 사용자 요청: 오류 추적 이벤트 패널 하단에 7일 추세 그래프.
          4개 도메인 합산 일별 카운트 (UTC). last_seen_at 기준 버킷.
          데이터 부재 시 안내 문구만 표시 — 추세 그래프 자체는 항상 mount. */}
      <PanelCard
        title="오류 추적 — 7일 추세"
        description="펌웨어 / 서버 / AI / 앱 도메인 이벤트 일별 합계 (UTC, 오늘 포함)."
      >
        {!trend7dBuckets.any7dOk ? (
          <div className="text-sm text-slate-500">
            7일 추세 데이터를 불러오지 못했습니다 (Server 미응답).
          </div>
        ) : !trend7dHasData ? (
          <div className="text-sm text-slate-500">
            최근 7일 동안 기록된 오류 이벤트가 없습니다. (양호)
          </div>
        ) : (
          <div>
            <BarChart
              data={trend7dBuckets.buckets.map((b) => ({ label: b.label, value: b.value }))}
              accent="#EC4899"
              height={180}
            />
            <div className="mt-2 text-[11px] text-slate-500 text-right">
              합계 {trend7dBuckets.buckets.reduce((s, b) => s + b.value, 0).toLocaleString()}건 · 일별
            </div>
          </div>
        )}
      </PanelCard>

      {/* 2026-06-10 — 사용자 요청: 마지막 "API 사용량" 카드 → "인형 잃어버린 신고 접수"
          로 교체. listLostReportsAction 결과를 상태별로 그룹핑해 큰 숫자 + 4-tile 분포.
          클릭 시 /dashboard/lost-reports 로 이동. */}
      <Link
        href="/dashboard/lost-reports"
        className="block rounded-3xl hover:shadow-card transition"
        aria-label="인형 잃어버린 신고 접수 페이지로 이동"
      >
        <PanelCard
          title="인형 잃어버린 신고 접수"
          description="사용자가 접수한 분실/도난 신고 건수와 처리 상태입니다."
          actions={<span className="text-xs text-slate-500">자세히 →</span>}
        >
          {!lostRes.ok ? (
            <div className="text-sm text-slate-500">
              분실/도난 신고 데이터를 불러오지 못했습니다 (Server 미응답).
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight text-slate-900">
                  {lostTotal.toLocaleString()}
                </span>
                <span className="text-xs text-slate-500">총 접수</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1">
                <MiniMetric label="대기" value={String(lostStatusCounts.pending)} tone={lostStatusCounts.pending > 0 ? "warn" : "muted"} />
                <MiniMetric label="처리중" value={String(lostStatusCounts.in_progress)} tone={lostStatusCounts.in_progress > 0 ? "warn" : "muted"} />
                <MiniMetric label="해결" value={String(lostStatusCounts.resolved)} tone="ok" />
                <MiniMetric label="반려" value={String(lostStatusCounts.rejected)} tone="muted" />
              </div>
            </div>
          )}
        </PanelCard>
      </Link>
    </div>
  );
}

// 2026-06-02 — SERVER overview.trend_7d 미반환 시 KPI 카드 sparkline 용 7일 fixture.
// 현재값을 기준으로 부드러운 sin 패턴 7개 버킷을 생성 (랜덤 X — SSR 재현성 위해).
// 미래에 SERVER 가 trend_7d 정본을 내려주면 본 함수는 호출되지 않는다.
function buildTrendFixture(
  sv: {
    active_devices: number;
    dau: number;
    reports_pending: number;
    queue_depth: number;
  } | null,
):
  | { active_devices: number[]; dau: number[]; reports_pending: number[]; queue_depth: number[] }
  | undefined {
  if (!sv) return undefined;
  // sin 0..6 → -1..1 → 0.85..1.15 곱(±15%) 한 후 정수 반올림. 마지막 버킷은 현재값.
  const wave = (current: number, phase: number): number[] =>
    Array.from({ length: 7 }, (_, i) => {
      if (i === 6) return Math.max(0, Math.round(current));
      const f = 0.85 + 0.15 * (1 + Math.sin((i + phase) / 1.8));
      return Math.max(0, Math.round(current * f));
    });
  return {
    active_devices: wave(sv.active_devices ?? 0, 0),
    dau: wave(sv.dau ?? 0, 1.2),
    reports_pending: wave(sv.reports_pending ?? 0, 2.4),
    queue_depth: wave(sv.queue_depth ?? 0, 3.6),
  };
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "ok" | "warn" | "critical" | "muted";
}) {
  const toneClass =
    tone === "critical"
      ? "text-rose-700"
      : tone === "warn"
        ? "text-amber-700"
        : tone === "ok"
          ? "text-emerald-700"
          : "text-slate-700";
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`text-lg font-bold ${toneClass}`}>{value}</div>
    </div>
  );
}

// 2026-06-10 — 오류 추적 — 24h 분포 패널의 라이프사이클 타일 (발생/조치/해결).
function LifecycleTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "ok" | "warn" | "critical";
}) {
  const toneClass =
    tone === "critical"
      ? "text-rose-700 border-rose-100 bg-rose-50/40"
      : tone === "warn"
        ? "text-amber-700 border-amber-100 bg-amber-50/40"
        : "text-emerald-700 border-emerald-100 bg-emerald-50/40";
  return (
    <div className={`rounded-lg border px-3 py-2 flex items-center justify-between ${toneClass}`}>
      <span className="text-xs">{label}</span>
      <span className="text-xl font-bold tracking-tight">{value.toLocaleString()}</span>
    </div>
  );
}

// 2026-06-10 — "오류 추적 이벤트" KpiChip 푸터에 들어가는 등록 KEY 30일 사용량 strip.
//   토큰 합계 / cap (M 단위) + 가로 진행 막대. cap 미설정 시 "한도 미설정" 표시.
function GeminiUsageStrip({
  tokens,
  cap,
  pct,
  tone,
  available,
}: {
  tokens: number;
  cap: number | null;
  pct: number | null;
  tone: "emerald" | "amber" | "rose" | "slate";
  available: boolean;
}) {
  const TONE = {
    emerald: { bar: "bg-emerald-500", text: "text-emerald-700" },
    amber:   { bar: "bg-amber-500",   text: "text-amber-700" },
    rose:    { bar: "bg-rose-500",    text: "text-rose-700" },
    slate:   { bar: "bg-slate-400",   text: "text-slate-600" },
  }[tone];
  const fmtM = (n: number): string => `${(n / 1_000_000).toFixed(1)}M`;
  if (!available) {
    return (
      <div className="text-[10px] text-slate-400">Gemini 사용량 — 데이터 없음</div>
    );
  }
  const barPct = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  return (
    <div className="rounded-md bg-slate-50 border border-slate-100 px-2 py-1.5">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] text-slate-500">Gemini API 사용량 · 30일</span>
        <span className={`text-[10px] font-mono ${TONE.text}`}>
          {fmtM(tokens)}
          {cap != null ? ` / ${fmtM(cap)}` : " / 한도 미설정"}
          {pct != null ? ` (${pct.toFixed(1)}%)` : ""}
        </span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full ${TONE.bar}`} style={{ width: `${barPct}%` }} />
      </div>
    </div>
  );
}
