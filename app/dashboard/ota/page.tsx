"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import { MockDataBanner } from "../_components/MockDataBanner";
import {
  listFirmwareCatalogAction,
  type ListFirmwareResult,
} from "@/lib/actions/firmwareList";
import { listDeploymentsAction } from "@/lib/actions/deployments";
import {
  listFirmwareFailuresAction,
  type ListFirmwareFailuresResult,
} from "@/lib/actions/firmware";
import type {
  FirmwareVersionRow,
  DeploymentRow,
  DeploymentLedgerRow,
} from "@/lib/adminApi";

// Phase 14-D — ota 재설계.
// Server `GET /api/v1/admin/firmware` (versions + deployments 분리형) + `/deployments` ledger + `/firmware/failures`.
//
// 이전: mockOtaFirmwares 의 firmware별 합산 row (target/applied/failed count).
// 재설계: versions[] 카탈로그 (별도) + deployments[] 진행률 카드 (별도) + ledger + failures.
// firmwareDeploymentService canary→early→stable 자동 hold/rollback ledger 반영.

const channelChip: Record<string, string> = {
  stable: "chip chip-success",
  beta: "chip chip-info",
  canary: "chip chip-warn",
  dev: "chip chip-muted",
};
const stateChip = (state: string) =>
  state === "completed"
    ? "chip chip-success"
    : state === "aborted"
      ? "chip chip-error"
      : state === "paused" || state === "holding"
        ? "chip chip-warn"
        : state === "rolling"
          ? "chip chip-info"
          : "chip chip-muted";

function formatSize(b: number | null): string {
  if (b == null) return "—";
  if (b > 1_000_000) return `${(b / 1_000_000).toFixed(2)} MB`;
  if (b > 1000) return `${(b / 1000).toFixed(1)} KB`;
  return `${b} B`;
}

export default function OtaPage() {
  const [catalog, setCatalog] = useState<ListFirmwareResult | null>(null);
  const [ledger, setLedger] = useState<DeploymentLedgerRow[] | null>(null);
  const [failures, setFailures] = useState<ListFirmwareFailuresResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const [c, l, f] = await Promise.all([
        listFirmwareCatalogAction(),
        listDeploymentsAction({ limit: 30 }),
        listFirmwareFailuresAction(),
      ]);
      setCatalog(c);
      if (!c.ok) setError(c.message);
      else setError(null);
      if (l.ok) setLedger(l.items);
      if (f) setFailures(f);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const versions = catalog && catalog.ok ? catalog.versions : [];
  const deployments = catalog && catalog.ok ? catalog.deployments : [];

  const stats = useMemo(() => {
    const total = versions.length;
    const rolling = deployments.filter((d) => d.state === "rolling").length;
    const completed = deployments.filter((d) => d.state === "completed").length;
    const failedAttempts = deployments.reduce((s, d) => s + (d.failed ?? 0), 0);
    return { total, rolling, completed, failedAttempts };
  }, [versions, deployments]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="등록 빌드" value={String(stats.total)} hint="versions[]" accent="blue" />
        <StatCard
          label="진행 중 배포"
          value={String(stats.rolling)}
          hint="state=rolling"
          accent="orange"
        />
        <StatCard
          label="완료 배포"
          value={String(stats.completed)}
          hint="state=completed"
          accent="teal"
        />
        <StatCard
          label="실패 누적"
          value={stats.failedAttempts.toLocaleString()}
          hint="ota_attempts failed sum"
          accent="pink"
        />
      </section>

      <PanelCard
        title="펌웨어 빌드 카탈로그 — Server 정본"
        description="Server /api/v1/admin/firmware.versions — 채널/릴리즈 시각/SHA256/크기. 출고 가능 빌드는 stable 채널."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Server 도달 실패: {error}
          </div>
        ) : versions.length === 0 ? (
          <div className="text-sm text-muted">등록된 빌드가 없습니다.</div>
        ) : (
          <ul className="space-y-1 text-sm">
            {versions.map((v) => (
              <VersionRow key={v.version} v={v} />
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title="진행 중 / 최근 배포"
        description="Server /api/v1/admin/firmware.deployments — canary → early → stable 자동 진행률 + 자동 hold 시 cohort_id 표시."
      >
        {deployments.length === 0 ? (
          <div className="text-sm text-muted">배포 이력이 없습니다.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {deployments.map((d) => (
              <DeploymentCard key={d.id} d={d} />
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard
        title="배포 ledger (Phase 12 cohort hold/rollback)"
        description="Server /api/v1/admin/deployments — cursor 페이지네이션. hold_reason/abort_reason/rollback_window_until 정본 표시."
      >
        {!ledger ? (
          <div className="text-sm text-muted">불러오는 중</div>
        ) : ledger.length === 0 ? (
          <div className="text-sm text-muted">ledger 비어 있음</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {ledger.map((d) => (
              <li
                key={d.id}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-mono">{d.version}</span>
                  <span className={stateChip(d.state)}>{d.state}</span>
                  <span className="text-xs text-muted">
                    {d.started_at ?? "—"} → {d.completed_at ?? "진행 중"}
                  </span>
                </div>
                {d.hold_reason ? (
                  <div className="mt-1 text-xs text-amber-700">hold: {d.hold_reason}</div>
                ) : null}
                {d.abort_reason ? (
                  <div className="mt-1 text-xs text-red-700">abort: {d.abort_reason}</div>
                ) : null}
                {d.rollback_window_until ? (
                  <div className="mt-1 text-[11px] text-muted">
                    rollback window until {d.rollback_window_until}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      {failures && failures.ok && failures.data.total > 0 ? (
        <PanelCard
          title={`OTA 실패 집계 — ${failures.data.total}건 (since ${failures.data.since})`}
          description="firmware_deployment_failure + otaTelemetry 결합. 자세한 디바이스별 실패는 /dashboard/firmware-errors."
        >
          <div className="flex flex-wrap gap-2">
            {failures.data.by_reason.slice(0, 8).map((r) => (
              <span
                key={r.error_code}
                className="text-xs rounded-full bg-orange-50 border border-orange-200 px-2.5 py-1 text-orange-700"
              >
                <span className="font-mono">{r.error_code}</span>
                <span className="ml-1.5">{r.count}건</span>
              </span>
            ))}
          </div>
        </PanelCard>
      ) : null}

      <MockDataBanner
        reason="펌웨어 업로드 / 채널 전환 / 강제 rollback 액션 UI 는 별도 라운드. 본 페이지는 조회 + 진행률 시각화만."
        endpoint="POST /api/v1/admin/firmware/upload + /deployments/:id/{advance,abort,rollback} (Server 측 이미 구현, UI wiring TBD)"
      />
    </div>
  );
}

function VersionRow({ v }: { v: FirmwareVersionRow }) {
  return (
    <li className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
      <span className="font-mono">{v.version}</span>
      <span className={channelChip[v.channel] ?? "chip chip-muted"}>{v.channel}</span>
      <span className="text-xs text-muted">{v.released_at}</span>
      <span className="text-xs text-muted">{formatSize(v.size_bytes)}</span>
      {v.sha256 ? (
        <span className="text-[10px] font-mono text-muted">{v.sha256.slice(0, 12)}…</span>
      ) : null}
      {v.notes ? (
        <span className="text-xs text-slate-700 ml-2 truncate max-w-[40%]">{v.notes}</span>
      ) : null}
    </li>
  );
}

function DeploymentCard({ d }: { d: DeploymentRow }) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/55 px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-sm">{d.version}</span>
        <span className={stateChip(d.state)}>{d.state}</span>
      </div>
      <div className="mt-2 text-xs text-muted flex items-center gap-2 flex-wrap">
        <span>progress {d.rollout_percent}%</span>
        <span>✓ {d.succeeded.toLocaleString()}</span>
        <span>✗ {d.failed.toLocaleString()}</span>
        {d.cohort_id ? <span className="chip chip-info">cohort {d.cohort_id}</span> : null}
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-white/70 overflow-hidden">
        <div
          className={d.state === "aborted" ? "h-full bg-red-400" : "h-full bg-accent"}
          style={{ width: `${Math.min(d.rollout_percent, 100)}%` }}
        />
      </div>
      <div className="mt-2 text-[10px] text-muted">
        시작 {d.started_at ?? "—"} · 갱신 {d.updated_at}
      </div>
    </div>
  );
}
