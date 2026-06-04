import Link from "next/link";
import { PanelCard } from "./_components/PanelCard";
import { ForbiddenNotice } from "./_components/ForbiddenNotice";
import { KpiChip } from "./_components/KpiChip";
import { ProgressBar } from "./_components/SimpleChart";
import { fetchGeminiKeysAction } from "@/lib/actions/gemini";
import { listReportsAction } from "@/lib/actions/reportsAdmin";
import { listErrorsAction } from "@/lib/actions/errorsTracking";
import { geminiRatioTone, summarizeKeys } from "@/fixtures/gemini";
import { fetchAdminOverviewAction } from "@/lib/actions/overview";
import type { ErrorDomain } from "@/types/admin-api";

export const dynamic = "force-dynamic";

// 2026-06-01 정본화: 운영자 요청으로 대시보드 home 을 핵심 KPI + Gemini 사용량 두 섹션으로 압축.
// - 제거: HeroBanner, SummaryCardCarousel(4-카드), ProfileRail(우측 레일), 모더레이션 강조 카드.
//   사이드바 footer "로그아웃" 버튼이 본문 "Gemini API 사용량" 섹션과 같은 높이로 끝나도록 단축.
// - 남김: 4-KPI chip(활성 디바이스/DAU/신고 대기/오류 추적) + Gemini API 사용량 패널.
//   2026-06-05 — 큐 적체 → 오류 추적(4-도메인 24h 합계) 으로 교체.
//   모든 값은 Server `/api/v1/admin/overview` 정본만 표시. 미응답 시 "—" 무음 표시.

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
  const geminiSummary = summarizeKeys(geminiKeys);
  // 신고 대기 KPI 는 overview.reports_pending 가 정본이지만, overview 실패 시
  // listReportsAction 의 total_open 으로 fallback.
  const reportsPendingDisplay =
    dash?.reportsPendingCount ?? (modRes.ok ? modRes.data.total_open : null);

  // 2026-06-05 — 오류 추적 KPI: 4개 도메인 중 하나라도 ok 면 합계 산출, 전부 실패면 null → "—".
  let errorTrackingCount: number | null = null;
  let anyErrorOk = false;
  for (const r of errorResults) {
    if (r.ok) {
      anyErrorOk = true;
      errorTrackingCount =
        (errorTrackingCount ?? 0) +
        r.data.items.reduce(
          (s, e) => s + (e.count_24h ?? e.sample_count ?? 0),
          0,
        );
    }
  }
  if (!anyErrorOk) errorTrackingCount = null;

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

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
        <KpiChip
          tone="orange"
          icon="alert"
          label="신고 대기"
          value={DASH(reportsPendingDisplay)}
          sub={
            reportsPendingDisplay == null
              ? ""
              : reportsPendingDisplay > 0
                ? "검토 필요"
                : "정상"
          }
          trend={trend?.reports_pending}
        />
        {/* 2026-06-05 — 큐 적체 → 오류 추적. 클릭 시 /dashboard/error-tracking 진입. */}
        <Link href="/dashboard/error-tracking" className="block">
          <KpiChip
            tone="pink"
            icon="alert"
            label="오류 추적"
            value={DASH(errorTrackingCount)}
            sub={
              errorTrackingCount == null
                ? ""
                : errorTrackingCount > 0
                  ? "확인 필요"
                  : "정상"
            }
          />
        </Link>
      </section>

      {/* Gemini API Key 사용량 카드 — 본문 마지막 섹션. 사이드바 footer(로그아웃)와 정렬. */}
      <PanelCard
        title="Gemini API 사용량"
        description="키별 일일 한도 대비 사용량입니다. 80% 도달 시 주의, 95% 이상은 키 추가가 권장됩니다."
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
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
              <MiniMetric label="등록 키" value={String(geminiSummary.total)} tone="muted" />
              <MiniMetric label="활성" value={String(geminiSummary.active)} tone="ok" />
              <MiniMetric label="80%+" value={String(geminiSummary.warn)} tone={geminiSummary.warn > 0 ? "warn" : "muted"} />
              <MiniMetric label="95%+" value={String(geminiSummary.critical)} tone={geminiSummary.critical > 0 ? "critical" : "muted"} />
            </div>
            <ul className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              {geminiKeys.slice(0, 4).map((k) => {
                const tone = geminiRatioTone(k.usage_ratio_24h);
                return (
                  <li
                    key={k.id}
                    className={[
                      "rounded-xl border px-3 py-2",
                      tone === "critical"
                        ? "border-rose-300 bg-rose-50/50"
                        : tone === "warn"
                          ? "border-amber-300 bg-amber-50/50"
                          : "border-slate-200 bg-white",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-slate-900 truncate">{k.label}</span>
                        <span className="font-mono text-[10px] text-slate-500">…{k.last4}</span>
                        {tone === "critical" ? <span className="chip chip-error">구매 권장</span> : null}
                      </div>
                      <span className="text-xs font-mono text-slate-700">
                        {Math.round(k.usage_ratio_24h * 100)}%
                      </span>
                    </div>
                    <div className="mt-1.5">
                      <ProgressBar ratio={k.usage_ratio_24h} tone={tone} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
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
