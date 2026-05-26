"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import {
  listFirmwareFailuresAction,
  type ListFirmwareFailuresResult,
} from "@/lib/actions/firmware";
import {
  lookupErrorCode,
  operatorLabelForCode,
  USER_VISIBILITY_CHIP,
  USER_VISIBILITY_LABEL,
  CATEGORY_LABEL,
} from "@/lib/errorCatalog";

// Phase 14-A — firmware-errors 재설계.
// Server `GET /api/v1/admin/firmware/failures?version=&since=` (Phase 1) 단일 source.
// 응답: { total, since, version, by_reason: [{error_code, count}], devices: [{device_id_hash, deployment_id, error_code, phase, cohort, at}] }
//
// 이전: mockFirmwareErrors 의 firmware별 누적 row + 4 통계카드 + DataTable + Drawer.
// 재설계: Server `by_reason` GROUP BY → 통계 카드 + 코드별 분포, `devices` → 디바이스별 실패 목록.

export default function FirmwareErrorsPage() {
  const [versionFilter, setVersionFilter] = useState("");
  const [state, setState] = useState<ListFirmwareFailuresResult | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listFirmwareFailuresAction(
        versionFilter ? { version: versionFilter } : undefined,
      );
      setState(r);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    if (!state || !state.ok) return { total: 0, critical: 0, error: 0, warn: 0 };
    let critical = 0;
    let error = 0;
    let warn = 0;
    for (const r of state.data.by_reason) {
      // error_code → errorCatalog → severity 추정.
      // catalog 미수록 코드는 default "error" 분류 (보수적).
      const entry = lookupErrorCode(r.error_code);
      const sev = entry.userVisibility === "visible" ? "critical" :
                  entry.userVisibility === "in-character" ? "error" : "warn";
      if (sev === "critical") critical += r.count;
      else if (sev === "error") error += r.count;
      else warn += r.count;
    }
    return { total: state.data.total, critical, error, warn };
  }, [state]);

  const data = state && state.ok ? state.data : null;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="총 발생 건수"
          value={stats.total.toLocaleString()}
          hint={data ? `since ${data.since}` : "Server 응답 대기"}
          accent="orange"
        />
        <StatCard label="Critical (사용자 인지)" value={String(stats.critical)} hint="긴급 조치 필요" accent="pink" />
        <StatCard label="Error (in-character)" value={String(stats.error)} hint="조사 필요" accent="orange" />
        <StatCard label="Warn (silent)" value={String(stats.warn)} hint="추적 중" accent="teal" />
      </section>

      <PanelCard
        title="펌웨어 에러"
        description={data?.version ? `필터: v${data.version}` : undefined}
        actions={
          <>
            <input
              className="input max-w-[160px]"
              placeholder="FW version 필터"
              value={versionFilter}
              onChange={(e) => setVersionFilter(e.target.value)}
            />
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
            >
              {loading ? "조회 중..." : "조회"}
            </button>
          </>
        }
      >
        {!state ? (
          <div className="text-sm text-muted">불러오는 중</div>
        ) : !state.ok ? (
          <div className="text-sm text-emerald-700">✓ 최근 펌웨어 에러 없음.</div>
        ) : !data ? null : (
          <>
            {/* by_reason 분포 */}
            <div className="mb-4">
              <div className="text-xs text-muted mb-2">에러 코드별 분포 (상위 10)</div>
              {data.by_reason.length === 0 ? (
                <div className="text-sm text-emerald-700">✓ 최근 OTA 실패 없음.</div>
              ) : (
                <ul className="space-y-1">
                  {data.by_reason.slice(0, 10).map((r) => {
                    const entry = lookupErrorCode(r.error_code);
                    const pct = data.total > 0 ? (r.count / data.total) * 100 : 0;
                    return (
                      <li
                        key={r.error_code}
                        className="rounded-xl border border-white/60 bg-white/55 px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap text-xs">
                          <span className="font-mono">{r.error_code}</span>
                          <span className="text-slate-700">{operatorLabelForCode(r.error_code)}</span>
                          <span className="chip chip-muted">{CATEGORY_LABEL[entry.category]}</span>
                          <span className={USER_VISIBILITY_CHIP[entry.userVisibility]}>
                            {USER_VISIBILITY_LABEL[entry.userVisibility]}
                          </span>
                          <span className="ml-auto">
                            {r.count.toLocaleString()}건 · {pct.toFixed(1)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 rounded-full bg-white/70 overflow-hidden">
                          <div
                            className="h-full bg-accent"
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* devices 목록 */}
            <div>
              <div className="text-xs text-muted mb-2">실패 디바이스 (최근 50)</div>
              {data.devices.length === 0 ? (
                <div className="text-sm text-muted">해당 디바이스 없음.</div>
              ) : (
                <ul className="space-y-1 text-xs">
                  {data.devices.slice(0, 50).map((d, i) => (
                    <li
                      key={`${d.device_id_hash ?? "x"}-${i}`}
                      className="rounded-xl border border-white/60 bg-white/55 px-3 py-2"
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-mono">{d.device_id_hash ?? "—"}</span>
                        <span className="font-mono text-orange-700">{d.error_code}</span>
                        <span
                          className={
                            d.phase === "rolled_back" ? "chip chip-error" : "chip chip-warn"
                          }
                        >
                          {d.phase}
                        </span>
                        {d.cohort ? <span className="chip chip-info">cohort {d.cohort}</span> : null}
                        <span className="text-muted ml-auto">{d.at}</span>
                      </div>
                      {d.deployment_id ? (
                        <div className="mt-1 text-[10px] text-muted">
                          deployment <span className="font-mono">{d.deployment_id}</span>
                        </div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </PanelCard>
    </div>
  );
}
