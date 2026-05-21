import Link from "next/link";
import { StatCard } from "./_components/StatCard";
import { PanelCard } from "./_components/PanelCard";
import { ForbiddenNotice } from "./_components/ForbiddenNotice";
import {
  mockReports,
  mockFirmwareErrors,
  mockServerErrors,
  mockAppErrors,
  mockDevices,
  mockUserPerceivedErrorRate,
  USER_PERCEIVED_ERROR_SLO_TARGET,
  formatDate,
} from "@/lib/mockData";
import { mockHealthProbes, mockDeadLetters } from "@/lib/opsInfraMock";
import { fetchAdminOverviewAction } from "@/lib/actions/overview";
import { fetchLocalServicesHealthAction } from "@/lib/actions/localServicesHealth";

const accentPalette = ["blue", "pink", "orange", "teal"] as const;

export const dynamic = "force-dynamic";

// V2.0 #8 대시보드 홈 — Server `/api/v1/admin/overview` (Phase2-A) 가
// 도달 가능하면 실 데이터를 사용하고, 그렇지 않으면 mock 파생값으로 graceful fallback.
// Server 응답: active_devices · dau · errors_24h{server,app,firmware} · fallback_rate ·
//             queue_depth · server_health · firmware_critical_count · reports_pending.

export default async function DashboardHome() {
  // Server overview 시도 — 실패 시 mock fallback.
  const overviewResult = await fetchAdminOverviewAction();
  const sv = overviewResult.ok ? overviewResult.data : null;

  // V1.0 #1 — DEPLOY_TARGET=local 일 때 5개 로컬 서비스 health 한 화면 표시.
  const localHealth = await fetchLocalServicesHealthAction();

  const pendingReports = mockReports.filter((r) => r.status === "pending");
  const criticalFw = mockFirmwareErrors.filter((e) => e.severity === "critical");
  const recentSrv = mockServerErrors.slice(0, 3);
  const recentApp = mockAppErrors.slice(0, 3);

  // ── 핵심 KPI 집계 (Server 우선, fallback mock) ────────────────────
  const activeDevices = sv ? sv.active_devices : mockDevices.filter((d) => d.online).length;
  const totalDevices = mockDevices.length;

  const errors24h = sv
    ? sv.errors_24h.server + sv.errors_24h.app + sv.errors_24h.firmware
    : mockServerErrors.reduce((s, e) => s + e.count, 0) +
      mockAppErrors.reduce((s, e) => s + e.count, 0) +
      mockFirmwareErrors.reduce((s, e) => s + e.count, 0);

  // 사용자 인지 에러율 (오늘) — SLO 핵심 지표.
  const slo = mockUserPerceivedErrorRate.at(-1)!;
  const perceivedRate = slo.total_errors > 0 ? slo.user_visible / slo.total_errors : 0;
  const sloMet = perceivedRate <= USER_PERCEIVED_ERROR_SLO_TARGET;

  // 큐 적체 — Server overview 의 queue_depth 우선, 없으면 mock.
  const queueBacklog = sv ? sv.queue_depth : mockDeadLetters.length;

  // 서버 헬스 — Server overview 정본, 없으면 health probe mock.
  const probesDown = mockHealthProbes.filter((p) => p.status === "down").length;
  const probesDegraded = mockHealthProbes.filter((p) => p.status === "degraded").length;
  const probesOk = mockHealthProbes.filter((p) => p.status === "ok").length;
  const healthLabel = sv
    ? sv.server_health === "down"
      ? "장애"
      : sv.server_health === "degraded"
        ? "주의"
        : "정상"
    : probesDown > 0
      ? "장애"
      : probesDegraded > 0
        ? "주의"
        : "정상";
  const healthTone: "up" | "down" | "flat" =
    healthLabel === "장애" ? "down" : healthLabel === "주의" ? "flat" : "up";

  const dauLabel = sv ? sv.dau.toLocaleString() : "12,840";

  const kpis = [
    {
      label: "활성 디바이스",
      value: activeDevices.toLocaleString(),
      delta: `${totalDevices ? Math.round((activeDevices / totalDevices) * 100) : 0}% 온라인`,
      deltaTone: "up" as const,
      hint: `전체 ${totalDevices.toLocaleString()}대`,
    },
    {
      label: "일일 대화량 (DAU)",
      value: dauLabel,
      delta: sv ? "실시간" : "+4.2%",
      deltaTone: "up" as const,
      hint: sv ? "Server 24h refresh token 활성 사용자" : "전일 대비 (mock)",
    },
    {
      label: "사용자 인지 에러율",
      value: `${(perceivedRate * 100).toFixed(2)}%`,
      delta: sloMet ? "SLO 충족" : "SLO 위반",
      deltaTone: sloMet ? ("up" as const) : ("down" as const),
      hint: `목표 ≤ ${(USER_PERCEIVED_ERROR_SLO_TARGET * 100).toFixed(1)}%`,
    },
    {
      label: "큐 적체 (dead-letter)",
      value: queueBacklog.toLocaleString(),
      delta: queueBacklog > 0 ? "재투입 필요" : "정상",
      deltaTone: queueBacklog > 0 ? ("down" as const) : ("up" as const),
      hint: "운영 안정성 → replay 참조",
    },
  ];

  return (
    <div className="space-y-6">
      <ForbiddenNotice />

      {localHealth.deploy_target === "local" ? (
        <PanelCard
          title="로컬 개발 환경 — 5개 서비스 상태"
          description="DEPLOY_TARGET=local. 각 서비스가 켜져 있는지 한 화면에서 확인합니다."
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {localHealth.services.map((s) => (
              <div
                key={s.name}
                className="rounded-2xl border border-white/60 bg-white/55 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold uppercase">{s.name}</span>
                  <span
                    className={
                      s.status === "ok"
                        ? "chip chip-success"
                        : s.status === "down"
                          ? "chip chip-error"
                          : "chip chip-muted"
                    }
                  >
                    {s.status}
                  </span>
                </div>
                <div className="mt-1 text-[11px] text-muted line-clamp-2">{s.detail}</div>
              </div>
            ))}
          </div>
        </PanelCard>
      ) : null}

      {sv?.domains ? (
        <PanelCard
          title="시스템 6도메인 health (Server overview)"
          description="HW · Server · AI · App · Admin · AWS — Server /api/v1/admin/overview.domains 정본."
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {(["hw", "server", "ai", "app", "admin", "aws"] as const).map((k) => {
              const d = sv.domains![k];
              const chip =
                d.status === "ok"
                  ? "chip chip-success"
                  : d.status === "down"
                    ? "chip chip-error"
                    : d.status === "degraded"
                      ? "chip chip-warn"
                      : "chip chip-muted";
              return (
                <div
                  key={k}
                  className="rounded-2xl border border-white/60 bg-white/55 px-3 py-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold uppercase">{k}</span>
                    <span className={chip}>{d.status}</span>
                  </div>
                  <div className="mt-1 text-[11px] text-muted line-clamp-2">{d.detail}</div>
                  <div className="mt-1 text-[10px] text-muted">{d.observed_at}</div>
                </div>
              );
            })}
          </div>
        </PanelCard>
      ) : null}

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((m, i) => (
          <StatCard
            key={m.label}
            label={m.label}
            value={m.value}
            delta={m.delta}
            deltaTone={m.deltaTone}
            hint={m.hint}
            accent={accentPalette[i % accentPalette.length]}
          />
        ))}
      </section>

      {/* 2차 KPI — 에러/헬스/신고 운영 지표. */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="에러 발생 (24h)"
          value={errors24h.toLocaleString()}
          delta={`서버 ${mockServerErrors.length} · 앱 ${mockAppErrors.length} · FW ${mockFirmwareErrors.length} 유형`}
          deltaTone="flat"
          hint="전 카테고리 누적"
          accent="orange"
        />
        <StatCard
          label="서버 헬스"
          value={healthLabel}
          delta={`OK ${probesOk} · 주의 ${probesDegraded} · 장애 ${probesDown}`}
          deltaTone={healthTone}
          hint="health probe 집계"
          accent={probesDown > 0 ? "pink" : probesDegraded > 0 ? "orange" : "teal"}
        />
        <StatCard
          label="신고 처리 대기"
          value={String(pendingReports.length)}
          delta={pendingReports.length > 0 ? "검토 필요" : "없음"}
          deltaTone={pendingReports.length > 0 ? "down" : "up"}
          hint="pending 신고"
          accent="pink"
        />
        <StatCard
          label="펌웨어 크리티컬"
          value={String(criticalFw.length)}
          delta={criticalFw.length > 0 ? "긴급" : "없음"}
          deltaTone={criticalFw.length > 0 ? "down" : "up"}
          hint="critical 펌웨어 에러"
          accent="blue"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard
          title="처리 대기 신고"
          description={`${pendingReports.length}건의 신고가 검토를 기다립니다.`}
          actions={<Link href="/dashboard/reports" className="btn-outline text-xs">전체 보기 →</Link>}
        >
          {pendingReports.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">대기 중인 신고가 없습니다.</div>
          ) : (
            <ul className="space-y-3">
              {pendingReports.slice(0, 4).map((r) => (
                <li key={r.id} className="rounded-2xl bg-white/55 border border-white/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="chip chip-warn">{r.type}</span>
                    <span className="text-[11px] text-muted">{formatDate(r.created_at)}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700 line-clamp-2">{r.excerpt}</p>
                  <p className="mt-1 text-[11px] text-muted">사유: {r.reason} · 신고 {r.reported_count}회</p>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          title="펌웨어 크리티컬"
          description={`${criticalFw.length}건의 critical 펌웨어 에러`}
          actions={<Link href="/dashboard/firmware-errors" className="btn-outline text-xs">전체 보기 →</Link>}
        >
          <ul className="space-y-3">
            {(criticalFw.length ? criticalFw : mockFirmwareErrors).slice(0, 4).map((e) => (
              <li key={e.id} className="rounded-2xl bg-white/55 border border-white/60 p-3">
                <div className="flex items-center justify-between">
                  <span className={`chip ${e.severity === "critical" ? "chip-error" : e.severity === "error" ? "chip-warn" : "chip-muted"}`}>
                    {e.severity}
                  </span>
                  <span className="text-[11px] text-muted">{e.count}건</span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{e.error_code}</p>
                <p className="text-[11px] text-muted truncate">{e.message}</p>
              </li>
            ))}
          </ul>
        </PanelCard>

        <PanelCard
          title="서버 에러 (24h)"
          actions={<Link href="/dashboard/server-errors" className="btn-outline text-xs">전체 보기 →</Link>}
        >
          <ul className="space-y-3">
            {recentSrv.map((e) => (
              <li key={e.id} className="rounded-2xl bg-white/55 border border-white/60 p-3">
                <div className="flex items-center justify-between">
                  <span className={`chip ${e.status_code >= 500 ? "chip-error" : "chip-warn"}`}>{e.status_code}</span>
                  <span className="text-[11px] text-muted">{e.count}건</span>
                </div>
                <p className="mt-2 text-sm font-medium text-slate-800">{e.service}</p>
                <p className="text-[11px] text-muted truncate">{e.path}</p>
              </li>
            ))}
          </ul>
        </PanelCard>
      </section>

      <PanelCard
        title="앱 에러 최신"
        actions={<Link href="/dashboard/app-errors" className="btn-outline text-xs">전체 보기 →</Link>}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {recentApp.map((e) => (
            <div key={e.id} className="rounded-2xl bg-white/55 border border-white/60 p-3">
              <div className="flex items-center justify-between">
                <span className="chip chip-info">{e.platform}</span>
                <span className="text-[11px] text-muted">v{e.app_version}</span>
              </div>
              <p className="mt-2 text-sm font-medium text-slate-800">{e.error_type}</p>
              <p className="text-[11px] text-muted line-clamp-2">{e.message}</p>
              <p className="text-[11px] text-muted mt-1">{e.affected_users}명 영향 · {e.count}회</p>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}
