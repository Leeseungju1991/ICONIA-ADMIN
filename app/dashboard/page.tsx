import Link from "next/link";
import { StatCard } from "./_components/StatCard";
import { PanelCard } from "./_components/PanelCard";
import {
  mockDashboardMetrics,
  mockReports,
  mockFirmwareErrors,
  mockServerErrors,
  mockAppErrors,
  formatDate,
} from "@/lib/mockData";

const accentPalette = ["blue", "pink", "orange", "teal"] as const;

export default function DashboardHome() {
  const pendingReports = mockReports.filter((r) => r.status === "pending");
  const criticalFw = mockFirmwareErrors.filter((e) => e.severity === "critical");
  const recentSrv = mockServerErrors.slice(0, 3);
  const recentApp = mockAppErrors.slice(0, 3);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {mockDashboardMetrics.map((m, i) => (
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

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PanelCard
          title="처리 대기 신고"
          description={`${pendingReports.length}건의 신고가 검토를 기다립니다.`}
          actions={<Link href="/dashboard/reports" className="btn-outline text-xs">전체 보기 →</Link>}
        >
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
