"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { StatCard } from "../../_components/StatCard";
import { AdminToast, useAdminToast } from "../../_components/AdminToast";
import type { AdminSeedStatus } from "@/lib/adminApi";
import { getSeedStatusAction, runSeedAction } from "@/lib/actions/seed";

// (주)숨코리아 출시 정비 — Seed 상태 / 수동 실행.
//
// Server `/api/v1/admin/seed/{status,run}` (requireAdmin). 운영팀이 출시 직전 데모
// 데이터를 한 번 더 채워야 할 때 수동 실행. 매 실행은 사유 5자 이상 + Server audit_log.

type LoadError = { message: string; unreachable: boolean } | null;

function classifyError(message: string): LoadError {
  const unreachable =
    message.startsWith("ERR_NETWORK") ||
    message.startsWith("ERR_SERVER_UNAVAILABLE") ||
    message.includes("not_found") ||
    message.includes("준비") ||
    message === "Not Found";
  return { message, unreachable };
}

export default function OpsSeedPage() {
  const [status, setStatus] = useState<AdminSeedStatus | null>(null);
  const [error, setError] = useState<LoadError>(null);
  const [loading, startLoad] = useTransition();
  const [running, startRun] = useTransition();
  const [reason, setReason] = useState("");
  const { toast, setToast } = useAdminToast();
  const [lastResult, setLastResult] = useState<{
    duration_ms: number;
    counts: Record<string, number>;
  } | null>(null);

  const reload = useCallback(() => {
    startLoad(async () => {
      const r = await getSeedStatusAction();
      if (!r.ok) {
        setError(classifyError(r.message));
        setStatus(null);
      } else {
        setError(null);
        setStatus(r.data);
      }
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  function handleRun() {
    if (reason.trim().length < 5) {
      setToast({ message: "사유는 5자 이상 입력해야 합니다.", tone: "warning" });
      return;
    }
    if (typeof window !== "undefined") {
      const phrase = window.prompt(
        `Seed 수동 실행\n\n실행하려면 정확히 "SEED" 를 입력하세요.\n\n사유: ${reason.trim()}`,
      );
      if (phrase !== "SEED") {
        setToast({ message: "실행 취소 — 확인 문구 불일치.", tone: "warning" });
        return;
      }
    }
    startRun(async () => {
      const r = await runSeedAction({ reason: reason.trim() });
      if (!r.ok) {
        setToast({ message: `실행 실패: ${r.message}`, tone: "error" });
        return;
      }
      setLastResult({
        duration_ms: r.data.duration_ms,
        counts: r.data.counts ?? {},
      });
      setToast({ message: `Seed 실행 완료 (${r.data.duration_ms}ms)`, tone: "success" });
      setReason("");
      reload();
    });
  }

  const counts = Object.entries(status?.counts ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="마지막 실행 시각"
          value={status?.last_run_at ?? "—"}
          hint={status?.last_run_by ?? "시드 상태 조회 준비 중"}
          accent="blue"
        />
        <StatCard
          label="마지막 실행자"
          value={status?.last_run_by ?? "—"}
          hint="operator email"
          accent="teal"
        />
        <StatCard
          label="마지막 소요 (ms)"
          value={
            status?.duration_ms != null ? String(status.duration_ms) : "—"
          }
          hint="duration_ms"
          accent="orange"
        />
        <StatCard
          label="진행 중"
          value={status?.in_progress ? "예" : "아니오"}
          hint={status?.in_progress ? "다른 운영자가 실행 중" : "대기"}
          accent={status?.in_progress ? "pink" : "teal"}
        />
      </section>

      <PanelCard
        title="시드 데이터 카테고리별 개수"
        description="시드로 생성된 카테고리별 데이터 개수입니다."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300 disabled:opacity-60"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        {error ? (
          error.unreachable ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
              <div className="font-medium">준비 중</div>
              <div className="mt-1 text-xs text-muted">
                시드 상태 조회 준비 중입니다. 잠시 후 다시 시도하세요.
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-muted">
              아직 Seed 가 한 번도 실행되지 않았거나 카운트가 비어 있습니다.
            </div>
          )
        ) : counts.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            아직 Seed 가 한 번도 실행되지 않았거나 카운트가 비어 있습니다.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {counts.map(([k, v]) => (
              <div
                key={k}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-3"
              >
                <div className="text-[11px] text-muted truncate">{k}</div>
                <div className="mt-1 text-lg font-bold text-slate-900 font-mono">
                  {v.toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </PanelCard>

      <PanelCard
        title="Seed 수동 실행 (SRE 이상)"
        description="출시 직전에만 사용하세요. 실행 시 감사 로그에 영구 기록되며 확인 문구 입력이 필요합니다."
      >
        <div className="space-y-3">
          <label className="block">
            <span className="block text-xs text-muted mb-1">
              실행 사유 (5자 이상, 필수)
            </span>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 신규 환경 초기 데이터, 베타 키트 준비"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              minLength={5}
              disabled={running || status?.in_progress}
            />
          </label>
          <button
            type="button"
            onClick={handleRun}
            disabled={running || status?.in_progress || !!error?.unreachable}
            className="rounded-xl bg-rose-600 text-white text-sm px-4 py-2 disabled:opacity-50"
          >
            {running
              ? "실행 중..."
              : status?.in_progress
                ? "다른 운영자가 실행 중"
                : "Seed 실행"}
          </button>
          <p className="text-[11px] text-muted">
            ※ Seed 는 운영 데이터를 덮어쓰지 않고 보강만 합니다. 결과는 카테고리별
            증분 카운트로 반환.
          </p>
        </div>

        {lastResult ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-sm text-emerald-800">
            <div className="font-semibold">
              실행 완료 ({lastResult.duration_ms}ms)
            </div>
            <ul className="mt-2 grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {Object.entries(lastResult.counts)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([k, v]) => (
                  <li key={k} className="flex items-center justify-between">
                    <span className="truncate">{k}</span>
                    <span className="font-mono ml-2">{v.toLocaleString()}</span>
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </PanelCard>

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
