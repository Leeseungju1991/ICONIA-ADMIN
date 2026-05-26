"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import {
  listOpsReportsAction,
  runOpsReportAction,
} from "@/lib/actions/opsReports";
import type { OpsReportRow, OpsReportKind } from "@/lib/adminApi";
import type { OperatorRole } from "@/lib/operatorRoles";

// 양산직전 #21 — 운영 리포트 아카이브 (client).
//
// Server: opsReportScheduler 가 매일 02:00 / 일요일 02:30 KST 에 daily / weekly
// 리포트를 자동 생성. 본 화면은 보관된 리포트를 조회하고 superadmin 이 수동
// 트리거할 수 있게 한다. role 은 부모 server component 가 주입.

export default function ReportsArchiveClient({ role }: { role: OperatorRole }) {
  const [kind, setKind] = useState<OpsReportKind | "all">("all");
  const [items, setItems] = useState<OpsReportRow[]>([]);
  const [loadError, setLoadError] = useState<{ code?: string; message: string } | null>(null);
  const [isReloading, startReload] = useTransition();
  const [isRunning, startRun] = useTransition();
  const [runMsg, setRunMsg] = useState<string | null>(null);

  const canTrigger = role === "superadmin";

  function reload() {
    startReload(async () => {
      setLoadError(null);
      const r = await listOpsReportsAction(
        kind === "all" ? { limit: 30 } : { kind, limit: 30 },
      );
      if (!r.ok) {
        setLoadError({ code: r.code, message: r.message });
        setItems([]);
        return;
      }
      setItems(r.items);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  function manualRun(target: OpsReportKind) {
    setRunMsg(null);
    const fd = new FormData();
    fd.set("kind", target);
    startRun(async () => {
      const r = await runOpsReportAction(fd);
      if (!r.ok) {
        setRunMsg(`실패 (${r.code ?? "ERR"}): ${r.message}`);
        return;
      }
      setRunMsg(r.duplicate ? "이미 생성된 리포트가 있습니다 (멱등)." : `생성됨: ${r.id ?? "(id 없음)"}`);
      reload();
    });
  }

  const serverUnreachable =
    loadError?.code === "ERR_NETWORK" || loadError?.code === "ERR_SERVER_UNAVAILABLE";

  return (
    <div className="space-y-4">
      <PanelCard
        title="운영 리포트 아카이브"
        description="매일 02:00 / 일요일 02:30 KST 자동 생성. 수동 트리거는 최고관리자만 가능."
        actions={
          <select
            className="select max-w-[160px]"
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof kind)}
          >
            <option value="all">전체 종류</option>
            <option value="daily">일간</option>
            <option value="weekly">주간</option>
            <option value="quality">품질</option>
          </select>
        }
      >
        {/* 수동 트리거 — superadmin 한정. 그 외 role 은 안내 문구. */}
        {canTrigger ? (
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              type="button"
              onClick={() => manualRun("daily")}
              disabled={isRunning}
              className="rounded-2xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs disabled:opacity-60"
            >
              지금 일간 리포트 생성
            </button>
            <button
              type="button"
              onClick={() => manualRun("weekly")}
              disabled={isRunning}
              className="rounded-2xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs disabled:opacity-60"
            >
              지금 주간 리포트 생성
            </button>
            <button
              type="button"
              onClick={() => manualRun("quality")}
              disabled={isRunning}
              className="rounded-2xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs disabled:opacity-60"
            >
              지금 품질 리포트 생성
            </button>
            {runMsg ? (
              <span className="text-xs text-muted self-center">{runMsg}</span>
            ) : null}
          </div>
        ) : (
          <div className="mb-3 text-xs text-muted">
            수동 트리거 권한은 최고관리자(superadmin)만 보유합니다. 일간/주간 리포트는 스케줄러가 자동 생성합니다.
          </div>
        )}

        {/* 조회 결과 — Server 미가동/도달 실패 시 scary red 박스 대신 회색 안내 + 재시도. */}
        {serverUnreachable ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
            <div className="font-medium">Server 미가동</div>
            <div className="mt-1 text-xs text-muted">
              ICONIA-SERVER 가 응답하지 않습니다. 로컬에서는 <code>3. SERVER</code> 가 떠 있는지 확인하세요. 자동 스케줄(매일 02:00 / 일요일 02:30 KST) 은 Server 가 살아 있을 때만 동작합니다.
            </div>
            <button
              type="button"
              onClick={reload}
              disabled={isReloading}
              className="mt-2 rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {isReloading ? "재시도 중..." : "다시 시도"}
            </button>
          </div>
        ) : loadError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            조회 실패 ({loadError.code ?? "ERR"}): {loadError.message}
          </div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted">{isReloading ? "불러오는 중" : "보관된 리포트가 없습니다."}</div>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        r.kind === "daily"
                          ? "chip chip-info"
                          : r.kind === "weekly"
                            ? "chip chip-success"
                            : "chip chip-warn"
                      }
                    >
                      {r.kind}
                    </span>
                    <span className="text-xs font-mono">{r.period_start} ~ {r.period_end}</span>
                  </div>
                  <span className="text-xs text-muted">generated {r.generated_at}</span>
                </div>
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-accent">payload 보기</summary>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-white/70 p-2 text-[11px]">
                    {JSON.stringify(r.payload, null, 2)}
                  </pre>
                </details>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  );
}
