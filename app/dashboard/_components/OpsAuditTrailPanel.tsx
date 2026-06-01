"use client";

import { useEffect, useState } from "react";
import { PanelCard } from "./PanelCard";
import { listOpsAuditByAction, type OpsAuditEntry } from "@/lib/opsAuditTrail";

// 운영자 retry/rollback 시도의 로컬 audit trail 표시.
// 페이지마다 prefix 로 필터: "ota.", "push.", "persona.", "ops." 등.

const outcomeChip: Record<OpsAuditEntry["outcome"], string> = {
  queued: "chip chip-info",
  succeeded: "chip chip-success",
  failed: "chip chip-error",
};

const outcomeLabel: Record<OpsAuditEntry["outcome"], string> = {
  queued: "대기",
  succeeded: "성공",
  failed: "실패",
};

export type OpsAuditTrailRefresh = { tick: number };

export function OpsAuditTrailPanel({
  prefix,
  title = "운영자 활동 기록 (세션)",
  description = "이번 세션에서 수행한 재시도·롤백·수동 조치 내역입니다.",
  refresh,
}: {
  prefix: string;
  title?: string;
  description?: string;
  refresh?: OpsAuditTrailRefresh;
}) {
  const [entries, setEntries] = useState<OpsAuditEntry[]>([]);

  useEffect(() => {
    setEntries(listOpsAuditByAction(prefix));
  }, [prefix, refresh?.tick]);

  return (
    <PanelCard title={title} description={description}>
      {entries.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted">
          본 세션에서 기록된 운영자 액션이 없습니다.
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-2xl bg-white/55 border border-white/60 px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={outcomeChip[entry.outcome]}>
                    {outcomeLabel[entry.outcome]}
                  </span>
                  <span className="font-mono text-xs text-slate-700">
                    {entry.action}
                  </span>
                  <span className="text-xs text-slate-600 truncate">
                    {entry.target_label}
                  </span>
                </div>
                <div className="text-[11px] text-muted mt-1 truncate">
                  사유: {entry.reason}
                </div>
              </div>
              <div className="text-right text-[11px] text-muted shrink-0">
                <div>{new Date(entry.at).toLocaleString("ko-KR")}</div>
                <div className="font-mono">{entry.operator}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}
