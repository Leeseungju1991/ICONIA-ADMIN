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
import {
  fetchLocalServicesHealthAction,
  type ServicePing,
} from "@/lib/actions/localServicesHealth";

type ServicePingName = ServicePing["name"];

const accentPalette = ["blue", "pink", "orange", "teal"] as const;

export const dynamic = "force-dynamic";

const SERVICE_LABEL: Record<ServicePingName, string> = {
  server: "Server",
  ai: "AI",
  postgres: "Postgres",
  admin: "Admin",
  app: "App",
};

const SERVICE_GROUP: Record<ServicePingName, "backend" | "client"> = {
  server: "backend",
  ai: "backend",
  postgres: "backend",
  admin: "client",
  app: "client",
};

// 좌측 띠 색 — 그룹 즉시 식별. before pseudo-element 로 카드 안에 띠를 그려
// 5개가 일렬로 등간격 정렬되면서도 백엔드/클라이언트가 구분되도록 한다.
const GROUP_ACCENT: Record<"backend" | "client", string> = {
  backend: "before:bg-slate-500",
  client: "before:bg-indigo-500",
};

function ServiceRow({ services }: { services: ServicePing[] }) {
  // 항상 server → ai → postgres → admin → app 순서로 일렬 정렬.
  const order: ServicePingName[] = ["server", "ai", "postgres", "admin", "app"];
  const byName = new Map(services.map((s) => [s.name, s]));
  const ordered = order
    .map((n) => byName.get(n))
    .filter((s): s is ServicePing => Boolean(s));

  return (
    <div className="space-y-3">
      {/* 그룹 라벨 헤더 — 5칸 grid 에 백엔드 3 + 클라이언트 2 로 정확히 정렬. */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
        <div className="sm:col-span-3 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-slate-500" aria-hidden />
          <span className="font-semibold text-slate-700">백엔드 인프라</span>
          <span className="text-[10px] text-muted">3종</span>
        </div>
        <div className="sm:col-span-2 flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-indigo-500" aria-hidden />
          <span className="font-semibold text-indigo-700">클라이언트 표면</span>
          <span className="text-[10px] text-muted">2종</span>
        </div>
      </div>

      {/* 5개 카드 일렬 배치 — 좌측 색 띠로 그룹 구분. */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {ordered.map((s) => {
          const group = SERVICE_GROUP[s.name];
          const accent = GROUP_ACCENT[group];
          return (
            <div
              key={s.name}
              className={[
                "relative overflow-hidden rounded-2xl border border-white/60 bg-white/55 px-4 py-3",
                // 좌측 4px 띠 — 그룹 색으로 즉시 식별.
                "before:absolute before:left-0 before:top-0 before:h-full before:w-1",
                accent,
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-base sm:text-lg font-bold uppercase tracking-tight">
                  {SERVICE_LABEL[s.name]}
                </span>
                <span
                  className={[
                    "text-xs sm:text-sm font-bold px-2.5 py-1 rounded-full",
                    s.status === "ok"
                      ? "bg-emerald-100 text-emerald-700"
                      : s.status === "down"
                        ? "bg-red-100 text-red-700"
                        : "bg-slate-100 text-slate-600",
                  ].join(" ")}
                >
                  {s.status}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted line-clamp-2">{s.detail}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
  // 대시보드 미리보기는 최대 3건만, 나머지는 상세 페이지에서 — UX 통일.
  const PREVIEW_LIMIT = 3;
  const previewSrv = mockServerErrors.slice(0, PREVIEW_LIMIT);
  const previewApp = mockAppErrors.slice(0, PREVIEW_LIMIT);
  const previewReports = pendingReports.slice(0, PREVIEW_LIMIT);

  // ── 핵심 KPI 집계 (Server 우선, fallback mock) ────────────────────
  // Server overview 가 도달하면 그 수치가 정본. mock 은 Server 미가동 fallback.
  // 상세 페이지 (reports / app-errors / server-errors / firmware-errors) 가
  // Server 정본을 그대로 조회하므로 dashboard 도 같은 source 를 우선해야 숫자가 일치한다.
  const activeDevices = sv ? sv.active_devices : mockDevices.filter((d) => d.online).length;
  const totalDevices = mockDevices.length;
  // Server overview 응답의 reports_pending / errors_24h.{server,app,firmware} 가 있다면
  // 그 값이 표시 정본. 패널 리스트는 별도 endpoint 가 필요하므로 mock 미리보기 + "전체보기" 링크로 위임.
  const reportsPendingCount = sv ? sv.reports_pending : pendingReports.length;
  const fwCriticalCount = sv ? sv.firmware_critical_count : criticalFw.length;

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
          title="5개 서비스 상태"
          description="백엔드(인프라) 3종과 클라이언트(표면) 2종이 켜져 있는지 한 화면에서 확인합니다."
        >
          <ServiceRow services={localHealth.services} />
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
          value={String(reportsPendingCount)}
          delta={reportsPendingCount > 0 ? "검토 필요" : "없음"}
          deltaTone={reportsPendingCount > 0 ? "down" : "up"}
          hint={sv ? "Server overview 정본" : "pending 신고 (mock)"}
          accent="pink"
        />
        <StatCard
          label="펌웨어 크리티컬"
          value={String(fwCriticalCount)}
          delta={fwCriticalCount > 0 ? "긴급" : "없음"}
          deltaTone={fwCriticalCount > 0 ? "down" : "up"}
          hint={sv ? "Server overview 정본" : "critical 펌웨어 에러 (mock)"}
          accent="blue"
        />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard
          title="처리 대기 신고"
          description={`${reportsPendingCount}건의 신고가 검토를 기다립니다. 미리보기 ${PREVIEW_LIMIT}건.`}
          actions={<Link href="/dashboard/reports" className="btn-outline text-xs">전체 보기 →</Link>}
        >
          {previewReports.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">대기 중인 신고가 없습니다.</div>
          ) : (
            <ul className="space-y-3">
              {previewReports.map((r) => (
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
          title="앱 에러 최신"
          description={`최근 ${PREVIEW_LIMIT}건 미리보기.`}
          actions={<Link href="/dashboard/app-errors" className="btn-outline text-xs">전체 보기 →</Link>}
        >
          {previewApp.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">최근 앱 에러 없음.</div>
          ) : (
            <ul className="space-y-3">
              {previewApp.map((e) => (
                <li key={e.id} className="rounded-2xl bg-white/55 border border-white/60 p-3">
                  <div className="flex items-center justify-between">
                    <span className="chip chip-info">{e.platform}</span>
                    <span className="text-[11px] text-muted">v{e.app_version}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-800">{e.error_type}</p>
                  <p className="text-[11px] text-muted line-clamp-2">{e.message}</p>
                  <p className="text-[11px] text-muted mt-1">{e.affected_users}명 영향 · {e.count}회</p>
                </li>
              ))}
            </ul>
          )}
        </PanelCard>

        <PanelCard
          title="서버 에러 (24h)"
          description={`최근 ${PREVIEW_LIMIT}건 미리보기.`}
          actions={<Link href="/dashboard/server-errors" className="btn-outline text-xs">전체 보기 →</Link>}
        >
          {previewSrv.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted">최근 서버 에러 없음.</div>
          ) : (
            <ul className="space-y-3">
              {previewSrv.map((e) => (
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
          )}
        </PanelCard>
      </section>
    </div>
  );
}
