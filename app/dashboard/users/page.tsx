"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { mockUsers, formatDate, type UserRow } from "@/lib/mockData";
import { maskEmail, maskUserId, maskName } from "@/lib/maskPii";
import { recordOperatorAuditAction } from "@/lib/actions/auditLog";
import {
  forceLogoutUserAction,
  pauseUserAction,
  resumeUserAction,
  mfaResetUserAction,
  type UserMutationResult,
} from "@/lib/actions/userMutations";
import {
  finalizePipaDeletionAction,
  listPipaUsersAction,
  triggerPipaExportAction,
  type PipaActionResult,
} from "@/lib/actions/pipa";
import type { PipaUserRow } from "@/lib/adminApi";

// 강력 액션 2단계 확인 — /dashboard/ops 페이지와 같은 정책 (EXECUTE 정확 입력).
const TWO_STEP_PHRASE = "EXECUTE";
function twoStepConfirm(label: string): boolean {
  if (typeof window === "undefined") return false;
  const phrase = window.prompt(
    `${label}\n\n강력 액션입니다. 실행하려면 정확히 "${TWO_STEP_PHRASE}" 를 입력하세요.`,
  );
  return phrase === TWO_STEP_PHRASE;
}

// 오늘(현 mock 기준) 가입 회원 카운트 — created_at 이 마지막 2일 이내.
// 백엔드 미연동: 실 production 은 server time + day window 로 결정.
const TODAY_WINDOW_HOURS = 48;

// P1 §7 (2026-05-19) — 기본 표시는 마스킹. "마스킹 해제" 액션은 audit log + 향후 2FA 재확인.
// P1 §5 — drawer 의 운영자 액션 (강제 로그아웃 등) 은 server audit action 호출.

const statusChip: Record<UserRow["account_status"], string> = {
  active: "chip chip-success",
  paused: "chip chip-warn",
  deleted: "chip chip-muted",
  pending_deletion: "chip chip-error",
};

const statusLabel: Record<UserRow["account_status"], string> = {
  active: "활성",
  paused: "일시정지",
  deleted: "삭제됨",
  pending_deletion: "탈퇴 대기",
};

export default function UsersPage() {
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserRow["account_status"]>("all");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [unmaskedIds, setUnmaskedIds] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  async function handleUnmask(userId: string) {
    // V1.0 #12+#19+#20 (Phase 7) — PIPA 마스킹 해제 3중 가드:
    //   (a) 경고 모달 (사용자 인지) — confirm()
    //   (b) 사유 입력 (자유 텍스트 5자 이상) — prompt()
    //   (c) 감사 로그 기록 (이미 구현, action=admin_pii_unmasked)
    // TOTP 2차 검증은 Server endpoint 결정 후 후속 라운드. 본 라운드는 경고+사유.
    const confirmed =
      typeof window === "undefined"
        ? false
        : window.confirm(
            "이 사용자의 PII 마스킹을 해제합니다.\n\n" +
              "⚠ 이 행동은 영구 감사 로그(hash chain)에 기록되며 취소할 수 없습니다.\n" +
              "PIPA 안전성 확보 조치에 따라 정당한 사유가 있을 때만 수행하세요.\n\n" +
              "계속하시겠습니까?",
          );
    if (!confirmed) {
      setToast("마스킹 해제를 취소했습니다.");
      return;
    }
    const reasonText =
      typeof window !== "undefined"
        ? window.prompt(
            "마스킹 해제 사유를 입력하세요 (감사 로그에 기록, 5자 이상). 예: CS 문의 #1234 / 보안 조사 등.",
          )
        : null;
    if (!reasonText || reasonText.trim().length < 5) {
      setToast("사유가 5자 이상 필요합니다. 마스킹 해제가 취소되었습니다.");
      return;
    }
    const res = await recordOperatorAuditAction({
      action: "user.pii_unmasked",
      targetUserId: userId,
      reasonText: reasonText.trim(),
    });
    if (res.status === "error") {
      setToast("감사 로그 기록에 실패했습니다. 마스킹 해제가 차단되었습니다.");
      return;
    }
    setUnmaskedIds((prev) => {
      const next = new Set(prev);
      next.add(userId);
      return next;
    });
    setToast("마스킹을 해제했습니다. (감사 로그 기록됨)");
  }

  const filtered = useMemo(() => {
    return mockUsers.filter((u) => {
      if (statusFilter !== "all" && u.account_status !== statusFilter) return false;
      if (q) {
        const s = q.toLowerCase();
        return u.email.toLowerCase().includes(s) || u.display_name.toLowerCase().includes(s) || u.id.includes(s);
      }
      return true;
    });
  }, [q, statusFilter]);

  // 라이프사이클 가시화 stats — 라운드 4 (2026-05-20) E2E QC.
  const lifecycleStats = useMemo(() => {
    const now = Date.now();
    const windowMs = TODAY_WINDOW_HOURS * 60 * 60 * 1000;
    const signupsToday = mockUsers.filter(
      (u) => now - new Date(u.created_at).getTime() <= windowMs,
    ).length;
    const dauWindowMs = 24 * 60 * 60 * 1000;
    const dau = mockUsers.filter(
      (u) =>
        u.account_status === "active" &&
        now - new Date(u.last_login_at).getTime() <= dauWindowMs,
    ).length;
    const paused = mockUsers.filter((u) => u.account_status === "paused").length;
    const pendingDeletion = mockUsers.filter(
      (u) => u.account_status === "pending_deletion",
    ).length;
    const active = mockUsers.filter((u) => u.account_status === "active").length;
    const deleted = mockUsers.filter((u) => u.account_status === "deleted").length;
    return { signupsToday, dau, paused, pendingDeletion, active, deleted };
  }, []);

  const pipaTrackList = useMemo(
    () => mockUsers.filter((u) => u.account_status === "pending_deletion"),
    [],
  );

  const columns: Column<UserRow>[] = [
    {
      key: "id",
      header: "ID",
      render: (r) => (
        <span className="font-mono text-xs text-muted">
          {unmaskedIds.has(r.id) ? r.id : maskUserId(r.id)}
        </span>
      ),
    },
    {
      key: "name",
      header: "이름",
      render: (r) => (
        <span className="font-medium text-slate-800">
          {unmaskedIds.has(r.id) ? r.display_name : maskName(r.display_name)}
        </span>
      ),
    },
    {
      key: "email",
      header: "이메일",
      render: (r) => (unmaskedIds.has(r.id) ? r.email : maskEmail(r.email)),
    },
    { key: "status", header: "상태", render: (r) => <span className={statusChip[r.account_status]}>{statusLabel[r.account_status]}</span> },
    { key: "mfa", header: "MFA", render: (r) => r.totp_enabled ? <span className="chip chip-info">ON</span> : <span className="chip chip-muted">OFF</span> },
    { key: "dolls", header: "인형", align: "right", render: (r) => r.doll_count },
    { key: "last", header: "최근 로그인", render: (r) => <span className="text-xs text-muted">{formatDate(r.last_login_at)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button className="btn-outline text-xs" onClick={() => setSelected(r)} type="button">
          상세
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="오늘 가입"
          value={String(lifecycleStats.signupsToday)}
          hint={`최근 ${TODAY_WINDOW_HOURS}h (mock)`}
          accent="pink"
        />
        <StatCard
          label="DAU (활성·24h)"
          value={String(lifecycleStats.dau)}
          delta={`${lifecycleStats.active} 활성`}
          deltaTone="up"
          hint="last_login_at 기준"
          accent="blue"
        />
        <StatCard
          label="일시정지"
          value={String(lifecycleStats.paused)}
          hint="paused — 해제 대기"
          accent="orange"
        />
        <StatCard
          label="탈퇴 대기"
          value={String(lifecycleStats.pendingDeletion)}
          delta={`${lifecycleStats.deleted} 삭제됨`}
          deltaTone={lifecycleStats.pendingDeletion > 0 ? "down" : "flat"}
          hint="PIPA 보류 (30일)"
          accent="teal"
        />
      </section>

      <LivePipaPanel />

      {pipaTrackList.length > 0 ? (
        <PanelCard
          title="PIPA 권리 추적 — 탈퇴 보류 / 데이터 export 요청"
          description="개인정보보호법(PIPA) 제35조 열람 청구 + 제36조 삭제 요청. 보류 기간 30일 내 운영자가 export·복구 처리 가능. (mock — Phase 7 LivePipaPanel 가 Server 정본 표시 중)"
        >
          <ul className="space-y-2">
            {pipaTrackList.map((u) => (
              <li
                key={u.id}
                className="rounded-2xl bg-white/55 border border-white/60 px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="chip chip-error">탈퇴 대기</span>
                    <span className="chip chip-info">export 가능</span>
                    <span className="font-mono text-xs text-slate-700 truncate max-w-[260px]">
                      {unmaskedIds.has(u.id) ? u.email : maskEmail(u.email)}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    가입 {formatDate(u.created_at)} · 최근 로그인 {formatDate(u.last_login_at)} · ID{" "}
                    <span className="font-mono">{unmaskedIds.has(u.id) ? u.id : maskUserId(u.id)}</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="btn-outline text-xs"
                    type="button"
                    onClick={() => setSelected(u)}
                  >
                    상세
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-muted mt-3">
            ※ 본 목록은 `account_status === &quot;pending_deletion&quot;` 만 표시. export 다운로드 / 복구
            확정은 백엔드 endpoint (`/api/v1/admin/users/&lt;id&gt;/pipa/export`) 도입 후 활성화.
            모든 처리는 server canonical audit log 에 기록됩니다.
          </p>
        </PanelCard>
      ) : null}

      <PanelCard
        title="회원 검색"
        description="이메일·이름·ID로 회원을 찾고 상세 정보 및 운영자 액션을 수행합니다. 기본 표시는 PII 마스킹되어 있으며, 해제는 감사 로그에 기록됩니다."
        actions={
          <>
            <input
              className="input max-w-[260px]"
              placeholder="이메일/이름/ID 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="select max-w-[160px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">전체 상태</option>
              <option value="active">활성</option>
              <option value="paused">일시정지</option>
              <option value="pending_deletion">탈퇴 대기</option>
              <option value="deleted">삭제됨</option>
            </select>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="조건에 해당하는 회원이 없습니다." />
      </PanelCard>

      {toast ? (
        <div
          className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card"
          onAnimationEnd={() => setToast(null)}
        >
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">
            닫기
          </button>
        </div>
      ) : null}

      {selected ? (
        <UserDetailDrawer
          user={selected}
          unmasked={unmaskedIds.has(selected.id)}
          onUnmask={() => handleUnmask(selected.id)}
          onClose={() => setSelected(null)}
          onToast={(m) => setToast(m)}
        />
      ) : null}
    </div>
  );
}

function UserDetailDrawer({
  user,
  unmasked,
  onUnmask,
  onClose,
  onToast,
}: {
  user: UserRow;
  unmasked: boolean;
  onUnmask: () => void;
  onClose: () => void;
  onToast: (msg: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  // E2E QC 라운드 (2026-05-20): 파괴적 액션 (강제 로그아웃 / 탈퇴) 은 EXECUTE 2단계 확인.
  const DESTRUCTIVE_ACTIONS = new Set([
    "user.force_logout",
    "user.account_deleted",
  ]);

  function runAction(action:
    | "user.force_logout"
    | "user.account_paused"
    | "user.account_resumed"
    | "user.mfa_reset"
    | "user.account_deleted",
  label: string) {
    if (DESTRUCTIVE_ACTIONS.has(action) && !twoStepConfirm(label)) {
      onToast(`${label} 실행 취소 — 확인 문구 불일치.`);
      return;
    }
    const reason = window.prompt(`${label} 사유를 입력하세요 (감사 로그에 기록됩니다, 5자 이상).`);
    if (!reason || reason.trim().length < 5) {
      onToast("사유가 5자 이상 필요합니다. 액션을 취소했습니다.");
      return;
    }
    startTransition(async () => {
      const trimmed = reason.trim();
      // Phase1-A 가 server endpoint 를 추가한 액션은 실 mutation 호출. Server 가
      // 자체적으로 audit_log 를 hash chain 에 기록하므로 client-side audit 별도 호출은
      // 생략 (중복 방지). 본 라운드는 force_logout / paused / resumed / mfa_reset 만 wired.
      // account_deleted 는 PIPA finalize endpoint 가 Phase2-A 에서 superadmin 전용으로
      // 추가될 예정 — 임시로 audit-only 유지.
      let mutationResult: UserMutationResult | null = null;
      if (action === "user.force_logout") {
        mutationResult = await forceLogoutUserAction({ userId: user.id, reason: trimmed });
      } else if (action === "user.account_paused") {
        mutationResult = await pauseUserAction({ userId: user.id, reason: trimmed });
      } else if (action === "user.account_resumed") {
        mutationResult = await resumeUserAction({ userId: user.id, reason: trimmed });
      } else if (action === "user.mfa_reset") {
        mutationResult = await mfaResetUserAction({ userId: user.id, reason: trimmed });
      } else {
        // account_deleted — Phase2-A 의 PIPA finalize endpoint 호출.
        // 30일 grace 미경과 시 server 가 409 ERR_PIPA_GRACE_PERIOD 반환 — 사용자에게 그대로 전달.
        const finalize = await finalizePipaDeletionAction({
          userId: user.id,
          reason: trimmed,
        });
        if (!finalize.ok) {
          onToast(`${label} 실패 (${finalize.code ?? "ERR"}): ${finalize.message}`);
          return;
        }
        onToast(
          finalize.data.deleted_at
            ? `${label} 완료 — ${finalize.data.deleted_at} 에 hard delete 됨.`
            : `${label} 완료. (Server audit_log 기록됨)`,
        );
        return;
      }
      if (!mutationResult.ok) {
        onToast(`${label} 실패 (${mutationResult.code ?? "ERR"}): ${mutationResult.message}`);
        return;
      }
      onToast(
        mutationResult.note
          ? `${label} 완료 — ${mutationResult.note}`
          : `${label} 완료. (Server audit_log 기록됨)`,
      );
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/30">
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 relative">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">회원 상세</h3>
        <p className="text-xs text-muted mt-0.5">{unmasked ? user.id : maskUserId(user.id)}</p>

        <dl className="mt-5 space-y-3 text-sm">
          <Row k="이름" v={unmasked ? user.display_name : maskName(user.display_name)} />
          <Row k="이메일" v={unmasked ? user.email : maskEmail(user.email)} />
          <Row k="상태" v={<span className={statusChip[user.account_status]}>{statusLabel[user.account_status]}</span>} />
          <Row k="MFA" v={user.totp_enabled ? "활성화" : "비활성"} />
          <Row k="보유 인형" v={`${user.doll_count}개`} />
          <Row k="가입일" v={formatDate(user.created_at)} />
          <Row k="최근 로그인" v={formatDate(user.last_login_at)} />
        </dl>

        {!unmasked ? (
          <button className="mt-4 w-full btn-outline text-sm" type="button" onClick={onUnmask}>
            PII 마스킹 해제 (감사 로그 기록 + 향후 2FA 재확인)
          </button>
        ) : (
          <div className="mt-4 text-[11px] text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
            ⚠ PII 마스킹 해제 상태입니다. 본 행동은 감사 로그에 기록되었습니다.
          </div>
        )}

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            className="btn-outline text-sm disabled:opacity-60"
            type="button"
            disabled={isPending}
            onClick={() => runAction("user.force_logout", "강제 로그아웃")}
          >
            강제 로그아웃
          </button>
          <button
            className="btn-outline text-sm disabled:opacity-60"
            type="button"
            disabled={isPending}
            onClick={() => runAction("user.account_paused", "계정 일시정지")}
          >
            계정 일시정지
          </button>
          <button
            className="btn-outline text-sm disabled:opacity-60"
            type="button"
            disabled={isPending}
            onClick={() => runAction("user.account_resumed", "정지 해제 (활성화)")}
          >
            정지 해제
          </button>
          <button
            className="btn-outline text-sm disabled:opacity-60"
            type="button"
            disabled={isPending}
            onClick={() => runAction("user.mfa_reset", "MFA 초기화")}
          >
            MFA 초기화
          </button>
          <button
            className="btn-danger text-sm disabled:opacity-60"
            type="button"
            disabled={isPending}
            onClick={() => runAction("user.account_deleted", "탈퇴 처리")}
          >
            탈퇴 처리
          </button>
        </div>
        <p className="text-[11px] text-muted mt-3">※ 모든 액션 Server mutation 으로 wiring 완료. 탈퇴 처리는 PIPA finalize (30일 grace 검증). hash-chain audit_log 자동 기록.</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="text-sm text-slate-800 font-medium">{v}</dd>
    </div>
  );
}

// V2.0 #15 — Server `/api/v1/admin/users/pipa` (Phase2-A) 실 연동 패널.
// 기존 mockUsers 기반 pipaTrackList 와 병존 — Server 도달 시 실 데이터 표시.
function LivePipaPanel() {
  const [pendingItems, setPendingItems] = useState<PipaUserRow[] | null>(null);
  const [exportItems, setExportItems] = useState<PipaUserRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportToast, setExportToast] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    const [r1, r2] = await Promise.all([
      listPipaUsersAction({ status: "pending_deletion" }),
      listPipaUsersAction({ status: "recent_export" }),
    ]);
    if (!r1.ok || !r2.ok) {
      const msg = !r1.ok ? r1.message : !r2.ok ? r2.message : "unknown";
      setError(msg);
      setPendingItems(null);
      setExportItems(null);
    } else {
      setPendingItems(r1.data.items);
      setExportItems(r2.data.items);
    }
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function runExport(userId: string) {
    const reason = window.prompt(
      "PIPA export 트리거 사유를 입력하세요 (감사 로그에 기록, 5자 이상).",
    );
    if (!reason || reason.trim().length < 5) {
      setExportToast("사유가 5자 이상 필요합니다. 취소되었습니다.");
      return;
    }
    const r: PipaActionResult<{ id: string; status: string }> = await triggerPipaExportAction({
      userId,
      reason: reason.trim(),
    });
    if (!r.ok) {
      setExportToast(`실패 (${r.code ?? "ERR"}): ${r.message}`);
      return;
    }
    setExportToast(`export job ${r.data.id} 생성됨 (status=${r.data.status})`);
    reload();
  }

  return (
    <PanelCard
      title="PIPA 실시간 추적 (Server)"
      description="Server /api/v1/admin/users/pipa — 탈퇴 대기 / 최근 export 요청. SUPERADMIN_ONLY."
    >
      {loading ? (
        <div className="text-sm text-muted">불러오는 중</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Server 도달 실패: {error}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div>
            <div className="text-xs text-muted mb-2">
              탈퇴 대기 (pending_deletion) — {pendingItems?.length ?? 0}건
            </div>
            {pendingItems && pendingItems.length > 0 ? (
              <ul className="space-y-1">
                {pendingItems.slice(0, 10).map((u) => (
                  <li
                    key={u.user_id}
                    className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono">{u.user_id}</span>
                      <button
                        type="button"
                        onClick={() => runExport(u.user_id)}
                        className="rounded-lg bg-accent px-2 py-0.5 text-white text-[11px]"
                      >
                        export 강제
                      </button>
                    </div>
                    <div className="text-muted mt-1">
                      pending {u.pending_deletion_at ?? "—"} · purge{" "}
                      {u.scheduled_purge_at ?? "—"}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted">대기 사용자 없음.</div>
            )}
          </div>
          <div>
            <div className="text-xs text-muted mb-2">
              최근 export (recent_export) — {exportItems?.length ?? 0}건
            </div>
            {exportItems && exportItems.length > 0 ? (
              <ul className="space-y-1">
                {exportItems.slice(0, 10).map((u) => (
                  <li
                    key={u.user_id}
                    className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-xs"
                  >
                    <div className="font-mono">{u.user_id}</div>
                    <div className="text-muted mt-1">
                      export {u.recent_export_at ?? "—"}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-xs text-muted">최근 export 없음.</div>
            )}
          </div>
        </div>
      )}
      {exportToast ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {exportToast}
        </div>
      ) : null}
    </PanelCard>
  );
}
