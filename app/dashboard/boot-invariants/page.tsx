"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import {
  listBootInvariantViolationsAction,
  type ListBootInvariantViolationsResult,
} from "@/lib/actions/fleetInvariants";

// Phase 12 #8 — Fleet boot_invariant 위반 디바이스 페이지.
// Server `/api/v1/admin/devices/boot-invariant-violations` (SECOPS_OR_ABOVE).
// REQUIRED_BOOT_INVARIANT_MASK (기본 0x47) 미충족 디바이스 목록.

export default function BootInvariantsPage() {
  const [state, setState] = useState<ListBootInvariantViolationsResult | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listBootInvariantViolationsAction({ limit: 100 });
      setState(r);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-4">
      <PanelCard
        title={
          state?.ok
            ? `Fleet 출하 잠금 invariant 위반 — ${state.total.toLocaleString()}대`
            : "Fleet 출하 잠금 invariant 위반"
        }
        description="출하 보안 기준을 충족하지 못한 기기 목록입니다. 생산 라인이나 펌웨어 결함 점검에 사용됩니다."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs"
          >
            {loading ? "새로고침 중..." : "새로고침"}
          </button>
        }
      >
        {!state ? (
          <div className="text-sm text-muted">불러오는 중</div>
        ) : !state.ok ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Server 도달 실패: {state.message}
          </div>
        ) : state.items.length === 0 ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            ✓ 모든 디바이스가 required_mask 0x
            {state.required_mask.toString(16).padStart(2, "0")} 를 충족합니다.
          </div>
        ) : (
          <>
            <div className="mb-3 text-xs text-amber-700">
              required_mask = 0x{state.required_mask.toString(16).padStart(2, "0")} — 위반은 출하
              차단 권장 (회수 검토).
            </div>
            <ul className="space-y-2 text-sm">
              {state.items.map((d) => (
                <li
                  key={d.device_id}
                  className="rounded-xl border border-white/60 bg-white/55 px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-mono text-xs">{d.device_id}</span>
                    <span className="chip chip-error">위반</span>
                    <span className="font-mono text-xs">
                      mask 0x{d.mask.toString(16).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-amber-700">
                    누락 비트: <span className="font-mono">{d.missing_bits.join(", ")}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    fw {d.fw_version ?? "—"} · 마지막 부팅 {d.last_boot_at ?? "—"}
                  </div>
                </li>
              ))}
            </ul>
            {state.next_cursor ? (
              <div className="mt-3 text-xs text-muted">※ 추가 페이지 있음 (cursor).</div>
            ) : null}
          </>
        )}
      </PanelCard>
    </div>
  );
}
