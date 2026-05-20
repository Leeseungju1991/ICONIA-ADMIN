"use client";

import { useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { mockUsers, formatDate, type UserRow } from "@/lib/mockData";
import { maskEmail, maskUserId, maskName } from "@/lib/maskPii";
import { recordOperatorAuditAction } from "@/lib/actions/auditLog";

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
    // P1 §7 — PII 마스킹 해제는 매 클릭마다 audit log. (향후 2FA 재확인 prompt 삽입 지점.)
    const res = await recordOperatorAuditAction({
      action: "user.pii_unmasked",
      targetUserId: userId,
      reasonText: "운영자가 상세 화면에서 PII 마스킹을 해제했습니다.",
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

      {pipaTrackList.length > 0 ? (
        <PanelCard
          title="PIPA 권리 추적 — 탈퇴 보류 / 데이터 export 요청"
          description="개인정보보호법(PIPA) 제35조 열람 청구 + 제36조 삭제 요청. 보류 기간 30일 내 운영자가 export·복구 처리 가능. (mock — `/api/v1/admin/users/pipa` 미연동)"
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
      const res = await recordOperatorAuditAction({
        action,
        targetUserId: user.id,
        reasonText: reason.trim(),
      });
      if (res.status === "error") {
        onToast(`${label} 실패: 감사 로그 기록 단계에서 차단되었습니다. (${res.code ?? "ERR"})`);
        return;
      }
      onToast(`${label} 요청을 기록했습니다. (실제 처리는 백엔드 연동 후 활성화)`);
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
        <p className="text-[11px] text-muted mt-3">※ 데모 환경 — 액션은 감사 로그만 기록됩니다. 실제 백엔드 mutation 은 별도 라운드.</p>
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
