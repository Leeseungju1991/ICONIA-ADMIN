import Link from "next/link";
import { PanelCard } from "./_components/PanelCard";
import { ForbiddenNotice } from "./_components/ForbiddenNotice";
import { KpiChip } from "./_components/KpiChip";
import { ProgressBar } from "./_components/SimpleChart";
import { fetchGeminiKeysAction } from "@/lib/actions/gemini";
import { listReportsAction } from "@/lib/actions/reportsAdmin";
import { geminiRatioTone, summarizeKeys } from "@/fixtures/gemini";
import { fetchAdminOverviewAction } from "@/lib/actions/overview";

export const dynamic = "force-dynamic";

// 2026-06-01 정본화: 운영자 요청으로 대시보드 home 을 핵심 KPI + Gemini 사용량 두 섹션으로 압축.
// - 제거: HeroBanner, SummaryCardCarousel(4-카드), ProfileRail(우측 레일), 모더레이션 강조 카드.
//   사이드바 footer "로그아웃" 버튼이 본문 "Gemini API 사용량" 섹션과 같은 높이로 끝나도록 단축.
// - 남김: 4-KPI chip(활성 디바이스/DAU/신고 대기/큐 적체) + Gemini API 사용량 패널.
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

  const DASH = (n: number | null | undefined): string =>
    n == null ? "—" : n.toLocaleString();

  // Gemini 키 사용량 + 모더레이션 미해결 신고 카운트 (KPI chip 용).
  const [geminiRes, modRes] = await Promise.all([
    fetchGeminiKeysAction(),
    listReportsAction({ status: "open" }),
  ]);
  const geminiKeys = geminiRes.ok ? geminiRes.data.items : [];
  const geminiSummary = summarizeKeys(geminiKeys);
  // 신고 대기 KPI 는 overview.reports_pending 가 정본이지만, overview 실패 시
  // listReportsAction 의 total_open 으로 fallback.
  const reportsPendingDisplay =
    dash?.reportsPendingCount ?? (modRes.ok ? modRes.data.total_open : null);

  return (
    <div className="space-y-5">
      <ForbiddenNotice />

      {/* 2026-06-01 — 신고 대기 강조 박스. 4-KPI 그리드 위에 큰 배너로 표시.
          클릭 시 신고 조치 페이지(/dashboard/reports)로 이동. */}
      <Link
        href="/dashboard/reports"
        className="block rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-pink-50 px-5 py-4 hover:border-rose-300 hover:shadow-card transition-all"
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-xl bg-rose-100 text-rose-700 px-3 py-2 text-xs font-semibold">
              신고 대기
            </div>
            <div>
              <div className="text-3xl font-bold text-rose-900 leading-none">
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
          <div className="text-rose-700 text-sm font-medium whitespace-nowrap">
            신고 조치 →
          </div>
        </div>
      </Link>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiChip
          tone="indigo"
          icon="device"
          label="활성 디바이스"
          value={DASH(dash?.activeDevices)}
          sub=""
        />
        <KpiChip
          tone="teal"
          icon="chat"
          label="DAU"
          value={dash?.dauLabel ?? "—"}
          sub=""
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

      {/* Gemini API Key 사용량 카드 — 본문 마지막 섹션. 사이드바 footer(로그아웃)와 정렬. */}
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
