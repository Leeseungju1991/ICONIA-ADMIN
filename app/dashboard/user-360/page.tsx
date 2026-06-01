"use client";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { PanelCard } from "../_components/PanelCard";
import { UserSnapshotGrid, type ActionKey } from "../_components/UserSnapshotGrid";
import { UserTimeline } from "../_components/UserTimeline";
import { fetchUser360Action, fetchUser360TimelineAction, type User360ActionResult, type User360TimelineResult } from "@/lib/actions/user360";
import { listUsersAction, type ListUsersResult } from "@/lib/actions/usersList";
import { createAdminUserAction } from "@/lib/actions/adminUserCreate";
import { deleteUserAction } from "@/lib/actions/userMutations";
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

  // 전체 사용자 list (이메일+UUID 표) — 페이지 진입 시 자동 로드.
  const [usersList, setUsersList] = useState<ListUsersResult | null>(null);
  const [listLoading, startListLoad] = useTransition();

  function loadUsersList(emailQ: string = "") {
    startListLoad(async () => {
      const r = await listUsersAction({ email: emailQ, limit: 50 });
      setUsersList(r);
    });
  }

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
    loadUsersList("");
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onAction(key: ActionKey, ctx: { serial?: string }) {
    setReason("");
    setConfirmText("");
    setReasonModal({ key, serial: ctx.serial });
  }

  function executeModal() {
    if (!reasonModal) return;
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

  // 2026-06-01 — 사용자 추가 모달: 이메일·비밀번호·UUID(선택) → 실 server endpoint 호출.
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addUuid, setAddUuid] = useState("");
  const [addPending, startAdd] = useTransition();
  const [addError, setAddError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function submitAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setAddError(null);
    const email = addEmail.trim();
    const password = addPassword;
    const uuid = addUuid.trim();
    if (!email) { setAddError("이메일을 입력하세요."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setAddError("이메일 형식이 올바르지 않습니다."); return; }
    if (!password || password.length < 8) { setAddError("비밀번호는 8자 이상이어야 합니다."); return; }
    if (uuid && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
      setAddError("UUID 형식이 올바르지 않습니다 (8-4-4-4-12 hex). 비우면 자동 생성."); return;
    }
    startAdd(async () => {
      const r = await createAdminUserAction({
        email,
        password,
        agreedTermsVersion: "1.0",
        ageVerified: true,
        autoVerified: true,
        reason: "admin_manual_create",
        ...(uuid ? { id: uuid } : {}),
      });
      if (!r.ok) {
        if (r.code === "ERR_USER_EMAIL_EXISTS") { setAddError("이미 사용 중인 이메일입니다."); return; }
        if (r.code === "ERR_USER_ID_EXISTS") { setAddError("이미 사용 중인 UUID 입니다."); return; }
        setAddError(r.message || "사용자 추가 실패");
        return;
      }
      setToast(`사용자 추가 완료: ${r.data.user.email} (${r.data.user.id.slice(0, 8)}…)`);
      setAddEmail(""); setAddPassword(""); setAddUuid("");
      setAddOpen(false);
      loadUsersList("");
    });
  }

  function deleteRow(userId: string, email: string) {
    const confirm1 = window.prompt(`사용자 "${email}" 삭제\n\n강력 액션입니다. 실행하려면 정확히 "EXECUTE" 를 입력하세요.`);
    if (confirm1 !== "EXECUTE") {
      setToast("삭제 취소 — 확인 문구 불일치.");
      return;
    }
    const reasonText = window.prompt("삭제 사유 (감사 로그 기록, 5자 이상)");
    if (!reasonText || reasonText.trim().length < 5) {
      setToast("사유가 5자 이상 필요합니다. 삭제를 취소했습니다.");
      return;
    }
    void (async () => {
      const r = await deleteUserAction({ userId, reason: reasonText.trim() });
      if (!r.ok) { setToast(`삭제 실패: ${r.message}`); return; }
      setToast(r.note ?? "사용자가 삭제되었습니다. (감사 로그 기록됨)");
      loadUsersList("");
    })();
  }

  return (
    <div className="space-y-4">
      <PanelCard
        title="사용자 검색"
        description="이메일 · IC-시리얼 · UUID 중 하나로 한 사용자를 통합 관리합니다."
        actions={
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          >
            + 사용자 추가
          </button>
        }
      >
        <form onSubmit={runLookup} className="flex gap-2">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="예: user@iconia.example 또는 IC-A1B2C3D4 또는 UUID"
            className="flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-indigo-400" />
          <button type="submit" disabled={pending} className="rounded-2xl bg-indigo-600 hover:bg-indigo-700 px-5 py-3 text-sm font-medium text-white disabled:opacity-60">{pending ? "조회 중..." : "조회"}</button>
        </form>
      </PanelCard>

      <PanelCard
        title="사용자 목록"
        description={
          usersList && usersList.ok
            ? `이메일 · UUID · 가입일. 전체 ${usersList.total}명 중 ${usersList.users.length}명 표시.`
            : "이메일 · UUID · 가입일."
        }
        actions={
          <button
            type="button"
            onClick={() => loadUsersList("")}
            disabled={listLoading}
            className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs disabled:opacity-60"
          >
            {listLoading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        {!usersList ? (
          <div className="text-sm text-muted">불러오는 중</div>
        ) : !usersList.ok ? (
          <div className="text-sm text-rose-700">불러오기 실패: {usersList.message}</div>
        ) : usersList.users.length === 0 ? (
          <div className="text-sm text-muted">등록된 사용자가 없습니다.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-muted border-b border-slate-200">
                  <th className="px-2 py-2 font-medium">이메일</th>
                  <th className="px-2 py-2 font-medium">표시 이름</th>
                  <th className="px-2 py-2 font-medium">UUID</th>
                  <th className="px-2 py-2 font-medium">상태</th>
                  <th className="px-2 py-2 font-medium">가입일</th>
                  <th className="px-2 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {usersList.users.map((u) => (
                  <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-2 py-2 text-slate-800">{u.email}</td>
                    <td className="px-2 py-2 text-slate-700">{u.display_name || "—"}</td>
                    <td className="px-2 py-2 font-mono text-[11px] text-slate-500">{u.id}</td>
                    <td className="px-2 py-2">
                      <span
                        className={
                          u.account_status === "active"
                            ? "chip chip-success"
                            : u.account_status === "paused"
                              ? "chip chip-warn"
                              : "chip chip-muted"
                        }
                      >
                        {u.account_status ?? "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-xs text-muted">
                      {u.created_at ? u.created_at.slice(0, 10) : "—"}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        disabled={u.account_status === "deleted"}
                        onClick={() => deleteRow(u.id, u.email)}
                        className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs px-3 py-1.5"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      {okSnap ? (
        <>
          <PanelCard title={okSnap.snapshot.user.email} description={`UUID ${okSnap.snapshot.user.id} · 상태 ${okSnap.snapshot.user.account_status}`}>
            <UserSnapshotGrid snapshot={okSnap.snapshot} role={ROLE} onAction={onAction} />
          </PanelCard>
          <PanelCard title="이벤트 타임라인" description="audit + ops events (시간 역순)">
            <UserTimeline events={okTl?.events ?? []} />
          </PanelCard>
        </>
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

      {addOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <form onSubmit={submitAdd} className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">사용자 추가</h3>
            <p className="text-[11px] text-slate-500">
              이메일·비밀번호는 필수. UUID는 비우면 자동 생성됩니다. 약관 v1.0 / 19+ 확인 / 자동 검증은
              운영자 책임으로 자동 적용되며 감사 로그에 기록됩니다.
            </p>
            {addError ? (
              <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {addError}
              </div>
            ) : null}
            <label className="block text-xs text-slate-700">이메일 *
              <input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="user@example.com"
                required
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-700">비밀번호 (8자 이상) *
              <input
                type="password"
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
                minLength={8}
                required
                autoComplete="new-password"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
              />
            </label>
            <label className="block text-xs text-slate-700">UUID (선택 — 비우면 자동 생성)
              <input
                value={addUuid}
                onChange={(e) => setAddUuid(e.target.value)}
                placeholder="자동 생성하려면 비워두세요"
                maxLength={36}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm font-mono"
              />
            </label>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setAddOpen(false)} disabled={addPending} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm disabled:opacity-60">취소</button>
              <button type="submit" disabled={addPending} className="rounded-lg bg-indigo-600 disabled:opacity-50 text-white px-4 py-2 text-sm">
                {addPending ? "추가 중..." : "추가"}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card max-w-md">
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">닫기</button>
        </div>
      ) : null}
    </div>
  );
}
