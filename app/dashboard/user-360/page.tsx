"use client";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PanelCard } from "../_components/PanelCard";
import { UserSnapshotGrid, type ActionKey } from "../_components/UserSnapshotGrid";
import { UserTimeline } from "../_components/UserTimeline";
import { MockDataBanner } from "../_components/MockDataBanner";
import { fetchUser360Action, fetchUser360TimelineAction, type User360ActionResult, type User360TimelineResult } from "@/lib/actions/user360";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";

const ROLE: import("@/lib/operatorRoles").OperatorRole = "superadmin"; // TODO: layout 에서 prop 으로 주입

export default function User360Page() {
  const sp = useSearchParams();
  const router = useRouter();
  const initial = sp.get("q") ?? "";
  const [q, setQ] = useState(initial);
  const [snap, setSnap] = useState<User360ActionResult | null>(null);
  const [tl, setTl] = useState<User360TimelineResult | null>(null);
  const [pending, start] = useTransition();
  const [reasonModal, setReasonModal] = useState<{ key: ActionKey; serial?: string } | null>(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  function runLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = q.trim();
    if (!trimmed) return;
    router.replace(`/dashboard/user-360?q=${encodeURIComponent(trimmed)}`);
    start(async () => {
      const [s, t] = await Promise.all([
        fetchUser360Action(trimmed),
        fetchUser360TimelineAction(trimmed),
      ]);
      setSnap(s);
      setTl(t);
    });
  }

  useEffect(() => {
    if (initial) {
      start(async () => {
        const [s, t] = await Promise.all([
          fetchUser360Action(initial),
          fetchUser360TimelineAction(initial),
        ]);
        setSnap(s);
        setTl(t);
      });
    }
  // 최초 마운트만
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onAction(key: ActionKey, ctx: { serial?: string }) {
    setReason("");
    setConfirmText("");
    setReasonModal({ key, serial: ctx.serial });
  }

  function executeModal() {
    if (!reasonModal) return;
    // 실제 server action 매핑은 Task 23 에서 추가. 지금은 audit 기록만.
    const fallbackId = snap?.ok ? snap.snapshot.user.id : "(unknown)";
    void recordOpsAuditWithSilentRetry({
      action: `user360.${reasonModal.key}`,
      target_label: reasonModal.serial ? "device" : "user",
      target_id: reasonModal.serial ?? fallbackId,
      reason,
      operator: "(unknown)",
      outcome: "queued",
    });
    setReasonModal(null);
  }

  const okSnap = snap?.ok ? snap : null;
  const okTl = tl?.ok ? tl : null;

  return (
    <div className="space-y-4">
      <PanelCard title="사용자 검색" description="이메일 · IC-시리얼 · UUID 중 하나로 한 사용자를 통합 관리합니다.">
        <form onSubmit={runLookup} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: user@iconia.example 또는 IC-A1B2C3D4 또는 UUID"
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400" />
          <button type="submit" disabled={pending} className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{pending ? "조회 중..." : "조회"}</button>
        </form>
      </PanelCard>

      {okSnap?.source === "mock" ? <MockDataBanner reason="Server /api/v1/admin/user360 미연결 — mock 표시" endpoint="/api/v1/admin/user360" /> : null}

      {okSnap ? (
        <>
          <PanelCard title={okSnap.snapshot.user.email} description={`UUID ${okSnap.snapshot.user.id} · 상태 ${okSnap.snapshot.user.account_status}`}>
            <UserSnapshotGrid snapshot={okSnap.snapshot} role={ROLE} onAction={onAction} />
          </PanelCard>
          <PanelCard title="이벤트 타임라인" description="audit + ops events (시간 역순)">
            <UserTimeline events={okTl?.events ?? []} />
          </PanelCard>
        </>
      ) : snap && !snap.ok ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">조회 실패: {snap.message}</div>
      ) : null}

      {reasonModal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">액션 확인 — {reasonModal.key}</h3>
            {reasonModal.serial ? <p className="text-xs text-muted">대상: {reasonModal.serial}</p> : null}
            <label className="block text-xs text-slate-700">사유 (5자 이상)
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" rows={3} />
            </label>
            <label className="block text-xs text-slate-700">확인 — 정확히 &quot;EXECUTE&quot; 입력
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setReasonModal(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">취소</button>
              <button type="button" disabled={reason.trim().length < 5 || confirmText !== "EXECUTE"} onClick={executeModal}
                className="rounded-lg bg-red-600 disabled:opacity-50 text-white px-4 py-2 text-sm">실행</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
