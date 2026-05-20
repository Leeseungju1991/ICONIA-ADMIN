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

const accentPalette = ["blue", "pink", "orange", "teal"] as const;

// 대시보드 홈 — 핵심 KPI 를 underlying mock 데이터에서 직접 집계해 한눈에 보여준다.
// 이전 버전은 고정 mockDashboardMetrics 문자열을 표시했으나, 실제 운영자에게
// 필요한 것은 디바이스/에러/큐/헬스 의 실시간 파생 지표 — 출시 라운드 (2026-05-20).
// TODO(server-wire-up): `/api/v1/admin/overview` 단일 KPI 엔드포인트로 교체.

export default function DashboardHome() {
  const pendingReports = mockReports.filter((r) => r.status === "pending");
  const criticalFw = mockFirmwareErrors.filter((e) => e.severity === "critical");
  const recentSrv = mockServerErrors.slice(0, 3);
  const recentApp = mockAppErrors.slice(0, 3);

  // ── 핵심 KPI 집계 ────────────────────────────────────────────────
  const activeDevices = mockDevices.filter((d) => d.online).length;
  const totalDevices = mockDevices.length;

  const errors24h =
    mockServerErrors.reduce((s, e) => s + e.count, 0) +
    mockAppErrors.reduce((s, e) => s + e.count, 0) +
    mockFirmwareErrors.reduce((s, e) => s + e.count, 0);

  // 사용자 인지 에러율 (오늘) — SLO 핵심 지표.
  const slo = mockUserPerceivedErrorRate.at(-1)!;
  const perceivedRate = slo.total_errors > 0 ? slo.user_visible / slo.total_errors : 0;
  const sloMet = perceivedRate <= USER_PERCEIVED_ERROR_SLO_TARGET;

  // 큐 적체 — dead-letter 큐 누적 건수.
  const queueBacklog = mockDeadLetters.length;

  // 서버 헬스 — health probe 상태 집계.
  const probesDown = mockHealthProbes.filter((p) => p.status === "down").length;
  const probesDegraded = mockHealthProbes.filter((p) => p.status === "degraded").length;
  const probesOk = mockHealthProbes.filter((p) => p.status === "ok").length;
  const healthLabel =
    probesDown > 0 ? "장애" : probesDegraded > 0 ? "주의" : "정상";
  const healthTone: "up" | "down" | "flat" =
    probesDown > 0 ? "down" : probesDegraded > 0 ? "flat" : "up";

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
      value: "12,840",
      delta: "+4.2%",
      deltaTone: "up" as const,
      hint: "전일 대비 (mock)",
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
