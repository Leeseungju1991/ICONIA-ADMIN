import Link from "next/link";
import { PanelCard } from "./_components/PanelCard";
import { ForbiddenNotice } from "./_components/ForbiddenNotice";
import { HeroBanner } from "./_components/HeroBanner";
import { KpiChip } from "./_components/KpiChip";
import { SummaryCardCarousel } from "./_components/SummaryCardCarousel";
import { ProfileRail } from "./_components/ProfileRail";
import { ProgressBar } from "./_components/SimpleChart";
import { fetchGeminiKeysAction } from "@/lib/actions/gemini";
import { listReportsAction } from "@/lib/actions/reportsAdmin";
import { geminiRatioTone, summarizeKeys } from "@/fixtures/gemini";
import { USER_PERCEIVED_ERROR_SLO_TARGET } from "@/lib/mockData";
import { fetchAdminOverviewAction } from "@/lib/actions/overview";
import { resolveHeroMode } from "@/lib/heroPriority";
import { fetchOperatorActivityAction } from "@/lib/actions/operatorActivity";
import { readSession } from "@/lib/authCookie";
import { resolveIdentity } from "@/lib/identity";

export const dynamic = "force-dynamic";

// 2026-05-27 정본화: ADMIN 대시보드는 mock fallback 0, AWS RDS 정본만 표시.
// - 모든 KPI: Server `/api/v1/admin/overview` 정본. 미응답 시 "—" 무음 표시 (사용자 요구: 에러/미가동 안내 텍스트 제거).
// - 4-box 약관 동의 KPI / 피드·커머스 24h KPI / 시스템 헬스 상세 펼치기: 사용자 요구로 모두 제거.
// - 커머스: 별도 라운드에서 ADMIN 표면 전면 제거됨 (앱·서버에서만 운영).
// - DEMO/mock 배지·banner 컴포넌트 (MockDataBanner) 폐기됨.

export default async function DashboardHome() {
  const overviewResult = await fetchAdminOverviewAction();
  const sv = overviewResult.ok ? overviewResult.data : null;

  const dash = sv
    ? {
        activeDevices: sv.active_devices,
        totalDevices: null as number | null,
        dauLabel: sv.dau.toLocaleString(),
        reportsPendingCount: sv.reports_pending,
        fwCriticalCount: sv.firmware_critical_count,
        errors24h:
          sv.errors_24h.server + sv.errors_24h.app + sv.errors_24h.firmware,
        errors24hByDomain: sv.errors_24h,
        queueBacklog: sv.queue_depth,
      }
    : null;

  // 사용자 인지 에러율 — server endpoint 도입 전까지 표시값 null.
  const perceivedRatePct: number | null = null as number | null;
  const sloMet: boolean | null = null as boolean | null;

  const DASH = (n: number | null | undefined): string =>
    n == null ? "—" : n.toLocaleString();

  // Gemini 키 사용량 + 모더레이션 미해결 신고 카운트.
  const [geminiRes, modRes] = await Promise.all([
    fetchGeminiKeysAction(),
    listReportsAction({ status: "open" }),
  ]);
  const geminiKeys = geminiRes.ok ? geminiRes.data.items : [];
  const geminiSummary = summarizeKeys(geminiKeys);
  const moderationOpenCount = modRes.ok ? modRes.data.total_open : 0;

  // Hero + operator profile.
  const activity = await fetchOperatorActivityAction();
  const jwt = readSession();
  const identity = jwt ? await resolveIdentity(jwt) : null;
  const operatorEmail = identity?.email ?? "operator@iconia.example";

  const hero: {
    mode: "critical" | "warn" | "ok";
    title: string;
    subtitle: string;
    cta?: { label: string; href: string };
  } = dash
    ? resolveHeroMode({
        firmware_critical_count: dash.fwCriticalCount,
        reports_pending: dash.reportsPendingCount,
        server_health: (sv?.server_health as "ok" | "degraded" | "down") ?? "ok",
        dead_letter_count: dash.queueBacklog,
        errors_24h: dash.errors24h,
      })
    : {
        mode: "ok",
        title: "ICONIA 운영 콘솔",
        subtitle: "주요 지표를 한눈에 확인하세요.",
      };

  return (
    <div className="space-y-6">
      <ForbiddenNotice />

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-5">
        <div className="space-y-5">
          <HeroBanner mode={hero.mode} title={hero.title} subtitle={hero.subtitle} cta={hero.cta} />

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <KpiChip
              tone="indigo"
              icon="device"
              label="활성 디바이스"
              value={DASH(dash?.activeDevices)}
              sub={
                dash?.totalDevices != null
                  ? `전체 ${dash.totalDevices.toLocaleString()}대`
                  : ""
              }
            />
            <KpiChip
              tone="teal"
              icon="chat"
              label="DAU"
              value={dash?.dauLabel ?? "—"}
              sub={dash ? "실시간" : ""}
            />
            <KpiChip
              tone="orange"
              icon="alert"
              label="인지 에러율"
              value={perceivedRatePct == null ? "—" : `${perceivedRatePct.toFixed(2)}%`}
              sub={sloMet == null ? "" : sloMet ? "SLO 충족" : "SLO 위반"}
            />
            <KpiChip
              tone="pink"
              icon="queue"
              label="큐 적체"
              value={DASH(dash?.queueBacklog)}
              sub={
                dash == null
                  ? ""
                  : dash.queueBacklog > 0
                    ? "재투입 필요"
                    : "정상"
              }
            />
          </section>

          <SummaryCardCarousel
            cards={[
              { id: "reports", title: "신고 대기", count: dash?.reportsPendingCount ?? null, hint: dash ? "검토 필요" : "—", href: "/dashboard/reports" },
              { id: "app", title: "앱 에러 (24h)", count: dash?.errors24hByDomain.app ?? null, hint: "—", href: "/dashboard/app-errors" },
              { id: "fw", title: "펌웨어 critical", count: dash?.fwCriticalCount ?? null, hint: dash ? "긴급" : "—", href: "/dashboard/firmware-errors" },
              { id: "srv", title: "서버 에러 (24h)", count: dash?.errors24hByDomain.server ?? null, hint: "—", href: "/dashboard/server-errors" },
            ]}
          />

          {/* Gemini API Key 사용량 카드. */}
          <PanelCard
            title="Gemini API 사용량"
            description="키별 일일 한도 대비 사용량. 80% 도달 시 주의, 95%+ 빨강 강조 + 구매 권장."
            actions={
              <Link href="/dashboard/ai-usage" className="btn-outline text-xs">
                자세히 →
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

          {/* 모더레이션 미해결 신고 강조 카드 — 0 건이면 숨김. */}
          {moderationOpenCount > 0 ? (
            <PanelCard
              title="모더레이션 — 미해결 신고"
              description="신고가 쌓이고 있습니다. 즉시 처리하세요."
              actions={
                <Link href="/dashboard/moderation" className="btn-outline text-xs">
                  처리하러 가기 →
                </Link>
              }
            >
              <div className="flex items-center gap-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
                <span className="text-3xl font-bold text-rose-700 tabular-nums">
                  {moderationOpenCount}
                </span>
                <div className="text-sm text-rose-700">
                  미해결 신고가 처리를 기다리고 있습니다.
                </div>
              </div>
            </PanelCard>
          ) : null}
        </div>

        <ProfileRail
          operatorEmail={operatorEmail}
          weekly={activity.ok ? activity.weekly : []}
        />
      </section>
    </div>
  );
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

// Keep USER_PERCEIVED_ERROR_SLO_TARGET import warm so future re-introduction is one-liner.
void USER_PERCEIVED_ERROR_SLO_TARGET;
