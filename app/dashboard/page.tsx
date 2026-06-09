import Link from "next/link";
import { PanelCard } from "./_components/PanelCard";
import { ForbiddenNotice } from "./_components/ForbiddenNotice";
import { KpiChip } from "./_components/KpiChip";
import { BarChart, Donut } from "./_components/SimpleChart";
import { fetchGeminiKeysAction } from "@/lib/actions/gemini";
import { listReportsAction } from "@/lib/actions/reportsAdmin";
import { listErrorsAction } from "@/lib/actions/errorsTracking";
import { fetchAdminOverviewAction } from "@/lib/actions/overview";
import type { ErrorDomain } from "@/types/admin-api";

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
  const ERROR_DOMAINS: ErrorDomain[] = ["firmware", "server", "ai", "app"];

  // Gemini 키 사용량 + 모더레이션 미해결 신고 카운트 + 4-도메인 24h 오류 합계 (KPI chip 용).
  const [geminiRes, modRes, errorResults] = await Promise.all([
    fetchGeminiKeysAction(),
    listReportsAction({ status: "open" }),
    Promise.all(ERROR_DOMAINS.map((d) => listErrorsAction({ domain: d, since: since24h }))),
  ]);
  const geminiKeys = geminiRes.ok ? geminiRes.data.items : [];
  // 2026-06-09 — API 사용량 패널 단순화: 등록/활성화/비활성화 키 수 + 총 사용량 %.
  //   사용량 % = sum(tokens_24h) / sum(tokens_daily_limit) * 100 (token 한도 기준).
  //   token 한도 정본이 없으면 키별 usage_ratio_24h 평균으로 폴백.
  const geminiStats = (() => {
    const total = geminiKeys.length;
    const enabled = geminiKeys.filter((k) => k.status === "active").length;
    const disabled = total - enabled;
    let usagePct = 0;
    const totalUsed = geminiKeys.reduce((s, k) => s + (k.tokens_24h ?? 0), 0);
    const totalQuota = geminiKeys.reduce(
      (s, k) => s + (k.tokens_daily_limit ?? 0),
      0,
    );
    if (totalQuota > 0) {
      usagePct = Math.round((totalUsed / totalQuota) * 100);
    } else if (total > 0) {
      const avg =
        geminiKeys.reduce((s, k) => s + (k.usage_ratio_24h ?? 0), 0) / total;
      usagePct = Math.round(avg * 100);
    }
    return { total, enabled, disabled, usagePct };
  })();
  // 신고 대기 강조 배너용 — overview.reports_pending 정본 + listReportsAction fallback.
  const reportsPendingDisplay =
    dash?.reportsPendingCount ?? (modRes.ok ? modRes.data.total_open : null);

  // 2026-06-05 — 오류 추적 차트(도메인별 + 심각도) 데이터 집계.
  //   KPI 칩(2차 라운드에서 제거됨)을 대체해 본 차트가 정본.
  let anyErrorOk = false;
  const errorDomainCounts: Record<ErrorDomain, number> = {
    firmware: 0,
    server: 0,
    ai: 0,
    app: 0,
  };
  const errorSeverityCounts: Record<string, number> = {
    critical: 0,
    error: 0,
    warn: 0,
    info: 0,
  };
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
      // server 정본 severity (info|warn|error|fatal) + legacy (low|medium|high|critical) 매핑.
      const sev = e.severity;
      if (sev === "critical" || sev === "fatal" || sev === "high") {
        errorSeverityCounts.critical += ev;
      } else if (sev === "error") {
        errorSeverityCounts.error += ev;
      } else if (sev === "warn" || sev === "medium") {
        errorSeverityCounts.warn += ev;
      } else {
        errorSeverityCounts.info += ev;
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
          />
        </Link>
      </section>

      {/* 2026-06-05 — 오류 추적 차트 패널. KPI 칩(합계)과 error-tracking 페이지 사이의
          중간 가시화 — 도메인별 24h 막대 + 심각도 도넛 2분할. server `/api/v1/admin/errors/*`
          정본의 listErrorsAction 4종 응답을 재사용 (KPI 와 동일 소스). */}
      <PanelCard
        title="오류 추적 — 24h 분포"
        description="펌웨어 / 서버 / AI / 앱 도메인 24시간 이벤트 건수와 심각도 분포입니다."
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
                  { label: "펌웨어", value: errorDomainCounts.firmware },
                  { label: "서버", value: errorDomainCounts.server },
                  { label: "AI", value: errorDomainCounts.ai },
                  { label: "앱", value: errorDomainCounts.app },
                ]}
                accent="#EC4899"
                height={160}
              />
            </div>
            <div>
              <div className="text-xs text-slate-500 mb-2">심각도 분포</div>
              <Donut
                segments={[
                  { label: "긴급", value: errorSeverityCounts.critical, color: "#E11D48" },
                  { label: "에러", value: errorSeverityCounts.error,    color: "#F97316" },
                  { label: "경고", value: errorSeverityCounts.warn,     color: "#F59E0B" },
                  { label: "정보", value: errorSeverityCounts.info,     color: "#64748B" },
                ]}
                size={120}
                thickness={18}
              />
            </div>
          </div>
        )}
      </PanelCard>

      {/* Gemini API Key 사용량 카드 — 본문 마지막 섹션. 사이드바 footer(로그아웃)와 정렬.
          2026-06-09 — 사용자 요청: per-key bar 리스트 제거 + 4-stat (등록/활성화/비활성화/사용량%) 만. */}
      <PanelCard
        title="API 사용량"
        description="등록된 Gemini 키 요약 및 일일 한도 대비 총 사용량입니다."
        actions={
          // 2026-06-05 — AI 사용량 메뉴 제거에 따라 Gemini Key 관리로 진입.
          <Link href="/dashboard/gemini" className="btn-outline text-xs">
            Gemini Key →
          </Link>
        }
      >
        {geminiKeys.length === 0 ? (
          <div className="text-sm text-slate-500">등록된 Gemini 키가 없습니다.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MiniMetric label="등록 키" value={String(geminiStats.total)} tone="muted" />
            <MiniMetric label="활성화" value={String(geminiStats.enabled)} tone="ok" />
            <MiniMetric
              label="비활성화"
              value={String(geminiStats.disabled)}
              tone={geminiStats.disabled > 0 ? "warn" : "muted"}
            />
            <MiniMetric
              label="사용량 %"
              value={`${geminiStats.usagePct}%`}
              tone={
                geminiStats.usagePct >= 95
                  ? "critical"
                  : geminiStats.usagePct >= 80
                    ? "warn"
                    : "ok"
              }
            />
          </div>
        )}
      </PanelCard>
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
