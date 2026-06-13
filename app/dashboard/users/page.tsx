"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { AutoRefreshToggle } from "../_components/AutoRefreshToggle";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import { formatDate, type UserRow } from "@/lib/mockData";
// 2026-06-02 — 사용자 요청: 이메일/표시이름/ID 마스킹 제거. lib/maskPii 는 legacy
// 참조용으로 보존(다른 surface 에서 사용). 본 페이지(목록·상세 drawer)에서는
// 호출하지 않고 원본을 그대로 표시. PII 접근 audit log 는 그대로 유지.
import { recordOperatorAuditAction } from "@/lib/actions/auditLog";
import {
  forceLogoutUserAction,
  pauseUserAction,
  resumeUserAction,
  mfaResetUserAction,
  resetUserPasswordAction,
  deleteUserAction,
  type UserMutationResult,
} from "@/lib/actions/userMutations";
import {
  finalizePipaDeletionAction,
  listPipaUsersAction,
  triggerPipaExportAction,
  type PipaActionResult,
} from "@/lib/actions/pipa";
import { listUsersAction } from "@/lib/actions/usersList";
import { getUserDetailAction } from "@/lib/actions/userDetail";
import { createAdminUserAction } from "@/lib/actions/adminUserCreate";
import type { PipaUserRow, UserRow as ServerUserRow, UserDetail } from "@/lib/adminApi";

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

// Server `ServerUserRow` (lib/adminApi) → UI UserRow shape adapter.
// Server 응답에 미존재한 필드(doll_count) 는 null 로 두고 UI 가 "—" 표시.
// 2026-06-10 — 사용자 요청: display_name 은 APP 가입 시 자동 부여되는 ID
//   (영문 5자 + 숫자 2자 = `[A-Za-z]{5}[0-9]{2}`). 미반환 시 fallback 으로 email
//   local-part 를 쓰면 ID 컬럼 의미가 흐려진다 → null 보존 + render 에서 "—" 표시.
function adaptServerUser(s: ServerUserRow): UserRow {
  // 2026-06-12 — 서버가 linked_dolls + doll_count 를 첨부 (adminUserService.searchUsers).
  //   미응답 시 (legacy server) null 폴백 — UI 는 "—" 표시.
  const linked = Array.isArray(s.linked_dolls) ? s.linked_dolls : null;
  const dollCount = typeof s.doll_count === "number" ? s.doll_count : (linked?.length ?? null);
  // 2026-06-12 (사용자 요청 #29) — 마케팅 수신여부. 서버 미응답 시 null → UI 가 "—" 표시.
  const marketing = typeof s.marketing_opt_in === "boolean" ? s.marketing_opt_in : null;
  return {
    id: s.id,
    email: s.email,
    display_name: s.display_name ?? "",
    account_status: (s.account_status ?? "active") as UserRow["account_status"],
    created_at: s.created_at ?? new Date().toISOString(),
    last_login_at: s.last_login_at ?? s.created_at ?? new Date().toISOString(),
    totp_enabled: Boolean(s.totp_enabled),
    doll_count: dollCount,
    linked_dolls: linked,
    marketing_opt_in: marketing,
  };
}

// APP 자동 생성 ID 형식: [A-Za-z]{5}[0-9]{2} (예: "abcde12", "Alice42").
const APP_SIGNUP_ID_RE = /^[A-Za-z]{5}[0-9]{2}$/;

export default function UsersPage() {
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserRow["account_status"]>("all");
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // 사용자 추가 페이지에서 돌아온 경우 — flash 토스트.
  useEffect(() => {
    const created = searchParams?.get("created");
    if (created) {
      setToast(`사용자 추가 완료 (ID: ${created.slice(0, 8)}…). 감사 로그에 기록되었습니다.`);
    }
  }, [searchParams]);

  // Phase 13-A — Server `/api/v1/admin/users` fetch. 도달 실패 시 빈 list + 에러 안내.
  // 2026-06-12 — 사용자 요청: email 정확 일치 검색. q 가 있으면 server 에 그대로 전달.
  //   server adminUserService 가 email equals (insensitive) 로 단건/0건 반환.
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const reloadUsers = useCallback(async (emailQuery?: string) => {
    setLoading(true);
    const r = await listUsersAction({
      limit: 200,
      ...(emailQuery ? { email: emailQuery } : {}),
    });
    if (!r.ok) {
      setLoadError(r.message);
      setUsers([]);
      setLoading(false);
      return { ok: false as const, count: 0 };
    }
    setLoadError(null);
    const adapted = r.users.map(adaptServerUser);
    setUsers(adapted);
    setLoading(false);
    return { ok: true as const, count: adapted.length };
  }, []);
  useEffect(() => {
    void reloadUsers();
  }, [reloadUsers]);

  // 2026-06-12 — 검색 실행. Enter 또는 "검색" 버튼.
  //   - 입력 비어있음: 전체 목록 reload + q 클리어.
  //   - 입력 있음: server exact match. 0건이면 alert 표출 + 화면 비움.
  async function handleSearch() {
    const v = searchInput.trim();
    setQ(v);
    setSearching(true);
    const r = await reloadUsers(v || undefined);
    setSearching(false);
    if (r.ok && v && r.count === 0) {
      // 사용자 요청: alert 로 명시.
      window.alert(`"${v}" 와 정확히 일치하는 이메일의 사용자가 없습니다.`);
    }
  }
  function handleClearSearch() {
    setSearchInput("");
    setQ("");
    void reloadUsers();
  }

  // 2026-06-02 — 마스킹 제거에 따라 "해제" 버튼 흐름 폐기.
  //   대신 drawer 가 열릴 때마다 1회 user.pii_unmasked audit 를 자동 기록한다.
  //   (PIPA: PII 접근 사실의 감사 가시성은 유지. 사유는 "drawer_open_auto" 고정.)
  async function recordPiiAccessAudit(userId: string) {
    const res = await recordOperatorAuditAction({
      action: "user.pii_unmasked",
      targetUserId: userId,
      reasonText: "drawer_open_auto",
    });
    if (res.status === "error") {
      setToast("PII 접근 감사 로그 기록 실패 — 운영자 확인 필요.");
    }
  }

  const filtered = useMemo(() => {
    // 2026-06-12 — 검색은 server exact match 로 일원화. 클라이언트 측은 status filter 와
    //   pending_deletion 제거만 담당 (검색 contains 로직 폐기).
    return users.filter((u) => {
      // 2026-06-11 — 사용자 요청: 탈퇴 대기(pending_deletion)는 회원 목록에서 숨김.
      if (u.account_status === "pending_deletion") return false;
      if (statusFilter !== "all" && u.account_status !== statusFilter) return false;
      return true;
    });
  }, [statusFilter, users]);

  // 라이프사이클 가시화 stats — 라운드 4 (2026-05-20) E2E QC.
  const lifecycleStats = useMemo(() => {
    const now = Date.now();
    const windowMs = TODAY_WINDOW_HOURS * 60 * 60 * 1000;
    const signupsToday = users.filter(
      (u) => now - new Date(u.created_at).getTime() <= windowMs,
    ).length;
    const dauWindowMs = 24 * 60 * 60 * 1000;
    const dau = users.filter(
      (u) =>
        u.account_status === "active" &&
        now - new Date(u.last_login_at).getTime() <= dauWindowMs,
    ).length;
    const paused = users.filter((u) => u.account_status === "paused").length;
    const pendingDeletion = users.filter(
      (u) => u.account_status === "pending_deletion",
    ).length;
    const active = users.filter((u) => u.account_status === "active").length;
    const deleted = users.filter((u) => u.account_status === "deleted").length;
    return { signupsToday, dau, paused, pendingDeletion, active, deleted };
  }, [users]);

  const pipaTrackList = useMemo(
    () => users.filter((u) => u.account_status === "pending_deletion"),
    [users],
  );

  // 2026-06-12 — 사용자 요청에 따라 컬럼 재구성:
  //   이메일 · 표시 이름 · 인형 연동(Y/N+개수) · 인형 번호(handle 목록) · 가입일 · 최근 접속일 · 액션
  //   기존 ID/MFA/상태/ID(앱) 컬럼은 제거. 상태/MFA 는 drawer 상세에서 계속 조회 가능.
  const columns: Column<UserRow>[] = useMemo(() => [
    {
      key: "email",
      header: "이메일",
      render: (r) => <span className="text-sm text-slate-800">{r.email}</span>,
    },
    {
      key: "display_name",
      header: "표시 이름",
      render: (r) => {
        const v = r.display_name?.trim() ?? "";
        const valid = v ? APP_SIGNUP_ID_RE.test(v) : false;
        // 2026-06-12 (사용자 요청 #29) — 표시이름 아래에 마케팅 수신여부 라인 추가.
        //   서버 `marketing_opt_in` 미응답이면 "—" (서버 응답 추가 필요).
        const marketing = r.marketing_opt_in;
        const marketingLabel =
          marketing === true ? "동의" : marketing === false ? "거부" : "—";
        const marketingClass =
          marketing === true
            ? "chip chip-success text-[10px]"
            : marketing === false
              ? "chip chip-muted text-[10px]"
              : "text-[10px] text-muted";
        return (
          <div className="flex flex-col gap-1">
            {v ? (
              <span
                className={
                  "font-mono text-sm " + (valid ? "text-slate-800" : "text-amber-700")
                }
                title={valid ? "APP 가입 자동 ID" : "legacy 또는 사용자 지정 표시이름"}
              >
                {v}
              </span>
            ) : (
              <span className="text-muted">—</span>
            )}
            <span className="flex items-center gap-1 text-[10px] text-muted">
              <span>마케팅</span>
              <span className={marketingClass}>{marketingLabel}</span>
            </span>
          </div>
        );
      },
    },
    {
      key: "doll_linked",
      header: "인형 연동",
      render: (r) => {
        const count = r.doll_count ?? r.linked_dolls?.length ?? null;
        if (count == null) return <span className="text-muted text-xs">—</span>;
        if (count === 0) {
          return <span className="chip chip-muted text-[11px]">미연동</span>;
        }
        return (
          <span className="chip chip-success text-[11px]">연동 · {count}대</span>
        );
      },
    },
    {
      key: "doll_handles",
      header: "인형 번호",
      render: (r) => {
        const list = r.linked_dolls ?? [];
        if (list.length === 0) return <span className="text-muted text-xs">—</span>;
        return (
          <div className="flex flex-wrap gap-1 max-w-[260px]">
            {list.map((d) => (
              <span
                key={d.id}
                className={
                  "font-mono text-[11px] rounded-md px-1.5 py-0.5 " +
                  (d.is_primary
                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                    : "bg-slate-100 text-slate-700 border border-slate-200")
                }
                title={`${d.nickname} · ${d.status}${d.is_primary ? " · primary" : ""}`}
              >
                {d.handle}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      key: "created_at",
      header: "가입일",
      render: (r) => (
        <span className="text-xs text-muted">{formatDate(r.created_at)}</span>
      ),
    },
    {
      key: "last_login_at",
      header: "최근 접속일",
      render: (r) => (
        <span className="text-xs text-muted">{formatDate(r.last_login_at)}</span>
      ),
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => {
        // 2026-06-05 — 사용자 요청: 목록에서 즉시 비활성/활성 토글
        // account_status="paused" 면 "활성화", "active" 면 "비활성화" 라벨로 토글.
        // deleted/pending_deletion 은 토글 자체가 의미 없으므로 disabled.
        const isPaused = r.account_status === "paused";
        const toggleDisabled =
          r.account_status === "deleted" || r.account_status === "pending_deletion";
        const toggleLabel = isPaused ? "활성화" : "비활성화";
        return (
          <div className="flex gap-1.5 justify-end">
            <button
              className="rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs px-3 py-1.5"
              type="button"
              disabled={toggleDisabled}
              onClick={async () => {
                if (isPaused) {
                  // 활성화(정지 해제) — 덜 파괴적이므로 EXECUTE 2단계 생략, 사유만 5자+.
                  const reason = window.prompt(
                    `사용자 "${r.email}" 활성화 (일시정지 해제) 사유를 입력하세요 (감사 로그 기록, 5자 이상).`,
                  );
                  if (!reason || reason.trim().length < 5) {
                    setToast("사유가 5자 이상 필요합니다. 활성화를 취소했습니다.");
                    return;
                  }
                  const res = await resumeUserAction({ userId: r.id, reason: reason.trim() });
                  if (!res.ok) {
                    setToast(`활성화 실패 (${res.code ?? "ERR"}): ${res.message}`);
                    return;
                  }
                  setToast(res.note ?? "사용자가 활성화되었습니다 (일시정지 해제). 감사 로그 기록됨.");
                  void reloadUsers();
                  return;
                }
                // 비활성화(일시정지) — 운영 안전상 EXECUTE 2단계 + 사유 5자+.
                if (!twoStepConfirm(`사용자 "${r.email}" 비활성화 (일시정지)`)) {
                  setToast("비활성화 취소 — 확인 문구 불일치.");
                  return;
                }
                const reason = window.prompt(
                  "비활성화(일시정지) 사유를 입력하세요 (감사 로그 기록, 5자 이상).",
                );
                if (!reason || reason.trim().length < 5) {
                  setToast("사유가 5자 이상 필요합니다. 비활성화를 취소했습니다.");
                  return;
                }
                const res = await pauseUserAction({ userId: r.id, reason: reason.trim() });
                if (!res.ok) {
                  setToast(`비활성화 실패 (${res.code ?? "ERR"}): ${res.message}`);
                  return;
                }
                // Server pauseUser 는 account_status 만 paused 로 바꾸고 활성 세션은 끊지 않는다.
                // 운영자가 즉시 세션을 끊고 싶다면 drawer 의 "강제 로그아웃" 을 별도로 실행해야 함.
                setToast(
                  (res.note ?? "사용자가 비활성화되었습니다 (일시정지). 감사 로그 기록됨.") +
                    " 활성 세션 차단이 필요하면 상세 → 강제 로그아웃을 실행하세요.",
                );
                void reloadUsers();
              }}
            >
              {toggleLabel}
            </button>
            <button
              className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs px-3 py-1.5"
              type="button"
              disabled={r.account_status === "deleted"}
              onClick={async () => {
                // 2026-06-01 — 사용자 요청: 상세 버튼 제거 + 삭제만 남김.
                // 삭제 확인 단계는 EXECUTE 문구 + 사유 5자 이상으로 사고 방지 (audit 기록).
                if (!twoStepConfirm(`사용자 "${r.email}" 삭제`)) {
                  setToast("삭제 취소 — 확인 문구 불일치.");
                  return;
                }
                const reason = window.prompt(
                  "삭제 사유를 입력하세요 (감사 로그 기록, 5자 이상).",
                );
                if (!reason || reason.trim().length < 5) {
                  setToast("사유가 5자 이상 필요합니다. 삭제를 취소했습니다.");
                  return;
                }
                const res = await deleteUserAction({ userId: r.id, reason: reason.trim() });
                if (!res.ok) {
                  setToast(`삭제 실패: ${res.message}`);
                  return;
                }
                setToast(res.note ?? "사용자가 삭제되었습니다. (감사 로그 기록됨)");
                void reloadUsers();
              }}
            >
              삭제
            </button>
          </div>
        );
      },
    },
  ], [reloadUsers]);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Link
          href="/dashboard/users/new"
          className="rounded-xl bg-accent px-3 py-2 text-sm text-white font-medium hover:opacity-90"
          data-testid="link-new-user"
        >
          + 사용자 추가
        </Link>
      </div>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="오늘 가입"
          value={String(lifecycleStats.signupsToday)}
          hint={`최근 ${TODAY_WINDOW_HOURS}h`}
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

      <LiveUsersPanel />

      <LivePipaPanel />

      {pipaTrackList.length > 0 ? (
        <PanelCard
          title="PIPA 권리 추적 — 탈퇴 보류 / 데이터 export 요청"
          description="개인정보보호법에 따른 열람·삭제 요청입니다. 보류 30일 이내에 데이터 내보내기·복구를 처리할 수 있습니다."
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
                      {u.email}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    가입 {formatDate(u.created_at)} · 최근 로그인 {formatDate(u.last_login_at)} · ID{" "}
                    <span className="font-mono">{u.id}</span>
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
            ※ 본 목록은 탈퇴 대기 상태(pending_deletion) 사용자만 표시합니다. 개인정보 내보내기와 복구 확정 기능은 서버 준비 완료 후 활성화됩니다.
            모든 처리는 운영 감사 로그에 자동 기록됩니다.
          </p>
        </PanelCard>
      ) : null}

      <InlineCreateUserPanel onCreated={(msg) => { setToast(msg); void reloadUsers(); }} />

      <PanelCard
        title="회원 검색"
        description="검색은 이메일 정확 일치만 가능합니다 (대소문자 무시). 비우고 검색하면 전체 목록을 표시합니다. 모든 PII 접근은 감사 로그에 자동 기록됩니다."
        actions={
          <>
            <input
              className="input w-full sm:max-w-[280px]"
              placeholder="이메일 입력 후 Enter (예: user@example.com)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleSearch();
                }
              }}
              type="email"
              autoComplete="off"
              data-testid="input-user-email-search"
            />
            <button
              type="button"
              onClick={() => void handleSearch()}
              disabled={searching}
              className="rounded-xl bg-accent px-3 py-2 text-sm text-white shadow-card disabled:opacity-60"
              data-testid="btn-user-email-search"
            >
              {searching ? "검색 중..." : "검색"}
            </button>
            {q ? (
              <button
                type="button"
                onClick={handleClearSearch}
                className="rounded-xl bg-white border border-slate-300 px-3 py-2 text-xs text-slate-700"
              >
                전체 보기
              </button>
            ) : null}
            <select
              className="select w-full sm:max-w-[160px]"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
            >
              <option value="all">전체 상태</option>
              <option value="active">활성</option>
              <option value="paused">일시정지</option>
              <option value="deleted">삭제됨</option>
            </select>
          </>
        }
      >
        {loading ? (
          <div className="text-sm text-muted px-1 py-6">불러오는 중...</div>
        ) : loadError ? (
          <div className="text-sm text-rose-700 px-1 py-6">
            불러오기 실패: {loadError}{" "}
            <button
              type="button"
              className="ml-2 underline text-slate-600"
              onClick={() => void reloadUsers(q || undefined)}
            >
              다시 시도
            </button>
          </div>
        ) : (
          <DataTable columns={columns} rows={filtered} empty="조건에 해당하는 회원이 없습니다." />
        )}
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
          onClose={() => setSelected(null)}
          onToast={(m) => setToast(m)}
          onMounted={(uid) => {
            void recordPiiAccessAudit(uid);
          }}
        />
      ) : null}
    </div>
  );
}

// 2026-06-13 (사용자 요청 #8) — 유저정보 목록의 사용자에 대해 서버가 반환하는
//   모든 데이터를 빠짐없이 표시한다. 서버(GET /api/v1/admin/users/:id)가 password
//   hash / refresh token / TOTP secret 등 비밀값은 제외하고 보내므로, 어드민은
//   응답에 들어오는 모든 필드를 그대로 렌더한다. 서버가 새 필드를 추가해도 자동
//   노출되도록 generic key/value 렌더러를 사용한다 (큐레이션된 상단 요약은 유지).

// 자주 등장하는 필드의 한국어 라벨. 미정의 키는 raw key 를 그대로 노출한다.
const FULL_DATA_FIELD_LABELS: Record<string, string> = {
  id: "ID (UUID)",
  email: "이메일",
  display_name: "표시 이름 (앱 ID)",
  account_status: "계정 상태",
  paused_at: "일시정지 일시",
  pending_deletion_at: "탈퇴 대기 일시",
  totp_enabled: "MFA(TOTP) 사용",
  last_login_at: "최근 로그인",
  created_at: "가입일",
  updated_at: "최근 수정",
  avatar_url: "아바타 URL",
  locale: "언어/로캘",
  proactive_enabled: "선제 발화 사용",
  quiet_hours: "방해 금지 시간",
  quiet_hours_start: "방해 금지 시작(시)",
  quiet_hours_end: "방해 금지 종료(시)",
  onboarded_at: "온보딩 완료",
  scheduled_purge_at: "삭제 예정일",
  consent_terms_version: "약관 동의 버전",
  consent_privacy_version: "개인정보 동의 버전",
  consent_accepted_at: "동의 일시",
  additional_consents: "추가 동의 항목",
  available_souls: "이용 가능 SOUL",
  marketing_opt_in: "마케팅 수신 동의",
  doll_count: "보유 인형 수",
  linked_dolls: "연동 인형",
  active_session_count: "활성 세션 수",
  // 인형/기기 하위 필드
  handle: "인형 번호(handle)",
  nickname: "별명",
  is_primary: "대표 여부",
  status: "상태",
  visibility: "공개 범위",
  follower_count: "팔로워 수",
  post_count: "게시물 수",
  device_id: "기기 ID",
  role: "역할",
};

function fullDataLabel(key: string): string {
  return FULL_DATA_FIELD_LABELS[key] ?? key;
}

// ISO 날짜처럼 보이는 문자열은 formatDate 로, 그 외 문자열/숫자/불리언은 그대로.
function looksLikeIsoDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v);
}

// 임의의 값(원시/배열/객체)을 사람이 읽기 좋은 ReactNode 로 렌더.
function renderFullValue(value: unknown): React.ReactNode {
  if (value == null) return <span className="text-muted">—</span>;
  if (typeof value === "boolean") return value ? "예" : "아니오";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value === "") return <span className="text-muted">(빈 값)</span>;
    if (looksLikeIsoDate(value)) return formatDate(value);
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-muted">(없음)</span>;
    // 객체 배열(연동 인형 등)은 항목별 key/value 블록으로 펼친다.
    if (value.some((it) => it && typeof it === "object")) {
      return (
        <div className="flex flex-col gap-2 w-full">
          {value.map((it, i) => (
            <div
              key={i}
              className="rounded-lg border border-white/60 bg-white/50 px-2 py-1.5"
            >
              {renderFullValue(it)}
            </div>
          ))}
        </div>
      );
    }
    // 원시값 배열은 콤마 결합.
    return value.map((v) => String(v)).join(", ");
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-muted">(없음)</span>;
    return (
      <div className="flex flex-col gap-1 w-full">
        {entries.map(([k, v]) => (
          <div key={k} className="flex items-start justify-between gap-2">
            <span className="text-[11px] text-muted shrink-0">{fullDataLabel(k)}</span>
            <span className="text-[11px] text-slate-800 text-right break-all">
              {renderFullValue(v)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return String(value);
}

// 객체의 모든 필드를 key/value 행으로 렌더 (서버가 반환한 그대로, 빠짐없이).
function FullDataObject({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="text-xs text-muted">표시할 데이터가 없습니다.</p>;
  }
  return (
    <dl className="space-y-1.5">
      {entries.map(([k, v]) => (
        <div
          key={k}
          className="flex items-start justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2"
        >
          <dt className="text-xs text-muted shrink-0 max-w-[45%] break-words">
            {fullDataLabel(k)}
            <span className="block font-mono text-[9px] text-slate-400">{k}</span>
          </dt>
          <dd className="text-xs text-slate-800 font-medium text-right break-all min-w-0">
            {renderFullValue(v)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function UserDetailDrawer({
  user,
  onClose,
  onToast,
  onMounted,
}: {
  user: UserRow;
  onClose: () => void;
  onToast: (msg: string) => void;
  onMounted?: (userId: string) => void;
}) {
  const [isPending, startTransition] = useTransition();
  // 2026-06-13 (사용자 요청 #8) — "전체 데이터" 섹션 펼침 상태 (기본 펼침).
  const [showAllData, setShowAllData] = useState(true);
  // 비밀번호 변경 모달 — 관리자가 사용자 비밀번호를 강제 재설정.
  // 2026-06-02 사용자 요청. server endpoint POST /api/v1/admin/users/:id/reset-password
  // 가 argon2id hash + 기존 refresh family revoke + audit_log admin_password_reset 자동 기록.
  const [showPwReset, setShowPwReset] = useState(false);

  // drawer 가 mount 될 때 1회 PII 접근 audit 기록 — 마스킹 제거에 따른 가시성 보존.
  useEffect(() => {
    if (onMounted) onMounted(user.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

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

  // 2026-06-01 — P0 fix: drawer 가 화면에 안 보인다는 보고. z-index 를 z-50 으로 올리고
  // Server `GET /api/v1/admin/users/:id` 로 fresh detail (active_session_count 포함) fetch.
  const [detail, setDetail] = useState<{
    active_session_count: number | null;
    fetchError: string | null;
    loading: boolean;
    // 2026-06-13 (사용자 요청 #3) — 서버 fresh 상세(프로필/동의/UX + 인형/기기) 보관.
    data: UserDetail | null;
  }>({ active_session_count: null, fetchError: null, loading: true, data: null });

  useEffect(() => {
    let alive = true;
    void (async () => {
      const r = await getUserDetailAction({ userId: user.id });
      if (!alive) return;
      if (r.ok) {
        setDetail({
          active_session_count: r.data.active_session_count ?? 0,
          fetchError: null,
          loading: false,
          data: r.data,
        });
      } else {
        setDetail({
          active_session_count: null,
          fetchError: r.message,
          loading: false,
          data: null,
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [user.id]);

  // 2026-06-13 (사용자 요청 #3) — 서버 fresh 상세(adminApi UserRow) 에서 확장 필드를 읽는다.
  //   drawer 의 `user` prop 은 페이지 로컬 row 타입이라 확장 필드가 없으므로 detail.data.user 사용.
  const du = detail.data?.user;
  const fmtBool = (b: boolean | null | undefined) => (b == null ? "—" : b ? "예" : "아니오");
  const fmtDate = (v: string | null | undefined) => (v ? formatDate(v) : "—");
  const quietHours = du?.quiet_hours ?? (du?.quiet_hours_start != null
    ? { start: du.quiet_hours_start, end: du.quiet_hours_end ?? 7 }
    : null);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/30">
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">회원 상세</h3>
        <p className="text-xs text-muted mt-0.5">{user.id}</p>

        <dl className="mt-5 space-y-3 text-sm">
          <Row k="ID (앱)" v={user.display_name || "—"} />
          <Row k="이메일" v={user.email} />
          <Row k="상태" v={<span className={statusChip[user.account_status]}>{statusLabel[user.account_status]}</span>} />
          <Row k="MFA" v={user.totp_enabled ? "활성화" : "비활성"} />
          <Row k="보유 인형" v={user.doll_count == null ? "—" : `${user.doll_count}개`} />
          <Row k="가입일" v={formatDate(user.created_at)} />
          <Row k="최근 로그인" v={formatDate(user.last_login_at)} />
          <Row
            k="활성 세션"
            v={
              detail.loading
                ? "로딩 중..."
                : detail.fetchError
                  ? <span className="text-xs text-amber-700">조회 실패</span>
                  : `${detail.active_session_count ?? 0}개`
            }
          />
          {/* 2026-06-13 (사용자 요청 #3) — 저장된 프로필/동의/UX 정보 전체 노출. */}
          <Row k="언어" v={du?.locale || "—"} />
          <Row k="선제 발화" v={fmtBool(du?.proactive_enabled)} />
          <Row k="마케팅 수신" v={fmtBool(du?.marketing_opt_in ?? user.marketing_opt_in)} />
          <Row k="방해 금지(조용한 시간)" v={quietHours ? `${quietHours.start}시 ~ ${quietHours.end}시` : "—"} />
          <Row k="온보딩 완료" v={fmtDate(du?.onboarded_at)} />
          <Row k="약관 동의 버전" v={du?.consent_terms_version || "—"} />
          <Row k="개인정보 동의 버전" v={du?.consent_privacy_version || "—"} />
          <Row k="동의 일시" v={fmtDate(du?.consent_accepted_at)} />
          <Row k="삭제 예정일" v={fmtDate(du?.scheduled_purge_at)} />
        </dl>

        {/* 2026-06-13 (사용자 요청 #3) — 보유 인형 (표시이름은 인형별 발급). */}
        {detail.data?.dolls && detail.data.dolls.length > 0 ? (
          <div className="mt-5">
            <h4 className="text-sm font-bold text-slate-900">보유 인형 ({detail.data.dolls.length})</h4>
            <ul className="mt-2 space-y-2">
              {detail.data.dolls.map((d) => (
                <li key={d.id} className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-xs text-slate-700">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{d.nickname || d.handle}</span>
                    {d.is_primary ? <span className="rounded-full bg-tan-soft px-2 py-0.5 text-[10px] text-tan-deep">대표</span> : null}
                  </div>
                  <div className="mt-1 text-muted">
                    표시이름 {d.display_name || "—"} · 번호 {d.handle} · 상태 {d.status || "—"} · 게시물 {d.post_count ?? 0} · 팔로워 {d.follower_count ?? 0}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 2026-06-13 (사용자 요청 #3) — 연동 기기. */}
        {detail.data?.devices && detail.data.devices.length > 0 ? (
          <div className="mt-4">
            <h4 className="text-sm font-bold text-slate-900">연동 기기 ({detail.data.devices.length})</h4>
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {detail.data.devices.map((dv) => (
                <li key={dv.device_id} className="rounded-xl border border-white/70 bg-white/60 px-3 py-1.5">
                  {dv.device_id}{dv.is_primary ? " · 대표" : ""}{dv.role ? ` · ${dv.role}` : ""} · {fmtDate(dv.created_at)}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* 2026-06-13 (사용자 요청 #8) — 전체 데이터(서버가 반환하는 모든 필드)를
            빠짐없이 노출. 상단의 큐레이션 요약과 별도로, 서버 응답 객체를 generic
            key/value 렌더러로 그대로 표시하므로 서버가 새 필드를 추가해도 자동
            노출된다. password hash / refresh token / TOTP secret 등 비밀값은
            서버 응답에서 이미 제외되어 들어오지 않는다. */}
        <div className="mt-5 border-t border-white/60 pt-4">
          <button
            type="button"
            className="flex w-full items-center justify-between text-sm font-bold text-slate-900"
            onClick={() => setShowAllData((v) => !v)}
            aria-expanded={showAllData}
            data-testid="btn-toggle-full-data"
          >
            <span>전체 데이터 (서버 응답 원본)</span>
            <span className="text-xs text-muted">{showAllData ? "접기" : "펼치기"}</span>
          </button>
          {showAllData ? (
            detail.loading ? (
              <p className="mt-3 text-xs text-muted">전체 데이터를 불러오는 중...</p>
            ) : detail.fetchError ? (
              <p className="mt-3 text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
                전체 데이터 조회 실패: {detail.fetchError}
              </p>
            ) : detail.data ? (
              <div className="mt-3 space-y-4" data-testid="full-data-section">
                <div>
                  <h5 className="text-xs font-semibold text-slate-700 mb-1.5">계정 / 프로필 / 동의 / 설정</h5>
                  {du ? (
                    <FullDataObject data={du as unknown as Record<string, unknown>} />
                  ) : (
                    <p className="text-xs text-muted">사용자 데이터가 없습니다.</p>
                  )}
                </div>
                <Row k="활성 세션 수" v={`${detail.data.active_session_count ?? 0}개`} />
                {detail.data.dolls && detail.data.dolls.length > 0 ? (
                  <div>
                    <h5 className="text-xs font-semibold text-slate-700 mb-1.5">
                      연동 인형 ({detail.data.dolls.length}) — 전체 필드
                    </h5>
                    {renderFullValue(detail.data.dolls)}
                  </div>
                ) : null}
                {detail.data.devices && detail.data.devices.length > 0 ? (
                  <div>
                    <h5 className="text-xs font-semibold text-slate-700 mb-1.5">
                      연동 기기 ({detail.data.devices.length}) — 전체 필드
                    </h5>
                    {renderFullValue(detail.data.devices)}
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-muted">표시할 전체 데이터가 없습니다.</p>
            )
          ) : null}
        </div>

        {/* 2026-06-02 — 사용자 요청에 따라 마스킹 제거. PII 접근은 audit log
            (user.pii_unmasked) 가 운영자 시점에 자동 기록된다 — 본 drawer 가
            열리는 시점에 1회 기록. */}
        <div className="mt-4 text-[11px] text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
          ⚠ PII 가 그대로 표시됩니다. 본 조회는 감사 로그에 자동 기록됩니다.
        </div>

        <div className="mt-4">
          <button
            className="btn-primary text-sm w-full disabled:opacity-60"
            type="button"
            disabled={isPending}
            onClick={() => setShowPwReset(true)}
            data-testid="btn-open-password-reset"
          >
            사용자 비밀번호 변경
          </button>
          <p className="text-[11px] text-muted mt-1">
            ※ 관리자가 직접 새 비밀번호를 입력합니다. 서버가 argon2id 로 해시하고
            기존 세션을 모두 로그아웃시키며 admin_password_reset 감사 로그를 기록합니다.
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
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
        <p className="text-[11px] text-muted mt-3">※ 모든 액션은 즉시 적용되며 감사 로그에 자동 기록됩니다. 탈퇴 처리는 개인정보 보호법에 따라 30일 유예 기간을 거쳐 완료됩니다.</p>
      </div>

      {showPwReset ? (
        <PasswordResetModal
          user={user}
          onClose={() => setShowPwReset(false)}
          onDone={(msg) => {
            setShowPwReset(false);
            onToast(msg);
          }}
        />
      ) : null}
    </div>
  );
}

// 2026-06-02 — 관리자 비밀번호 재설정 모달.
//   - 8자+ client 검증 (서버는 10자+영문/숫자 정책을 추가 강제).
//   - 새 비밀번호 / 확인 일치 검사.
//   - 사유 5자+ 강제 (audit log 메타).
//   - confirm 다이얼로그로 마지막 안전장치 — 우발 클릭 차단.
//   - Server 가 argon2id 해시 + refresh family revoke + audit 자동.
function PasswordResetModal({
  user,
  onClose,
  onDone,
}: {
  user: UserRow;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [reason, setReason] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function clientValidate(): string | null {
    if (!password) return "새 비밀번호를 입력하세요.";
    if (password.length < 8) return "비밀번호는 8자 이상이어야 합니다. (서버 정책은 10자 + 영문/숫자)";
    if (password !== confirm) return "비밀번호 확인이 일치하지 않습니다.";
    if (!reason || reason.trim().length < 5) return "사유는 5자 이상 입력해야 합니다.";
    return null;
  }

  function submit() {
    const ve = clientValidate();
    if (ve) { setError(ve); return; }
    setError(null);
    // 마지막 confirm — 우발 클릭 차단.
    const ok = window.confirm(
      `사용자 "${user.email}" 의 비밀번호를 새로 설정합니다.\n\n` +
        `기존 세션이 모두 로그아웃되고 감사 로그(admin_password_reset)가 기록됩니다.\n\n` +
        `계속하시겠습니까?`,
    );
    if (!ok) return;
    startTransition(async () => {
      const res = await resetUserPasswordAction({
        userId: user.id,
        password,
        reason: reason.trim(),
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onDone(res.note ?? "비밀번호가 재설정되었습니다. (감사 로그 기록됨)");
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-3 bg-black/40">
      <div
        className="w-full max-w-md glass-panel rounded-3xl p-6 relative"
        data-testid="modal-password-reset"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwreset-title"
      >
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
          aria-label="닫기"
        >
          닫기
        </button>
        <h3 id="pwreset-title" className="text-lg font-bold text-slate-900">비밀번호 변경</h3>
        <p className="text-xs text-muted mt-0.5">{user.email}</p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-700">
            새 비밀번호 (8자 이상, 영문+숫자)
            <div className="relative mt-1">
              <input
                className="input w-full pr-16"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                data-testid="input-new-password"
              />
              <button
                type="button"
                aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
                onClick={() => setShow((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md bg-white/70 border border-white/70 px-2 py-0.5 text-[11px] text-slate-600"
              >
                {show ? "숨기기" : "보기"}
              </button>
            </div>
          </label>
          <label className="block text-xs text-slate-700">
            새 비밀번호 확인
            <input
              className="input w-full mt-1"
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              data-testid="input-confirm-password"
            />
          </label>
          <label className="block text-xs text-slate-700">
            사유 (감사 로그 기록, 5자 이상)
            <textarea
              className="input mt-1 min-h-[64px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 사용자 요청 #1234 / 보안 사고 대응"
              maxLength={256}
              data-testid="input-reset-reason"
            />
          </label>
          {error ? (
            <p className="text-xs text-rose-700 bg-rose-50/80 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            className="btn-outline text-sm min-h-[44px]"
            type="button"
            onClick={onClose}
            disabled={pending}
          >
            취소
          </button>
          <button
            className="btn-primary text-sm disabled:opacity-60 min-h-[44px]"
            type="button"
            onClick={submit}
            disabled={pending}
            data-testid="btn-submit-password-reset"
          >
            {pending ? "변경 중..." : "비밀번호 변경"}
          </button>
        </div>
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

function InlineCreateUserPanel({ onCreated }: { onCreated: (msg: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [customId, setCustomId] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setEmail("");
    setPassword("");
    setCustomId("");
    setError(null);
  }

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await createAdminUserAction({
        email: email.trim(),
        password,
        agreedTermsVersion: "1.0",
        ageVerified: true,
        autoVerified: true,
        reason: "운영자 콘솔에서 직접 추가",
        ...(customId.trim() ? { id: customId.trim() } : {}),
      });
      if (!res.ok) {
        setError(res.message);
        onCreated(`사용자 추가 실패 (${res.code ?? "ERR"}): ${res.message}`);
        return;
      }
      onCreated(`사용자 추가 완료 (이메일: ${res.data.user.email})`);
      reset();
    });
  }

  return (
    <PanelCard
      title="사용자 빠른 추가"
      description="이메일·비밀번호로 즉시 계정을 생성합니다. ID 를 비워두면 자동 생성됩니다."
      actions={
        <button
          type="button"
          className="btn-outline text-xs"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? "접기" : "펼치기"}
        </button>
      }
    >
      {expanded ? (
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1 text-xs text-slate-700">
              <span>이메일 *</span>
              <input
                className="input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="user@example.com"
                autoComplete="off"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-700">
              <span>비밀번호 * (8자 이상)</span>
              <input
                className="input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-slate-700">
              <span>UUID (선택)</span>
              <input
                className="input font-mono"
                type="text"
                value={customId}
                onChange={(e) => setCustomId(e.target.value)}
                placeholder="비워두면 자동 생성"
                autoComplete="off"
              />
            </label>
          </div>
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-60"
              onClick={submit}
              disabled={isPending || !email || password.length < 8}
            >
              {isPending ? "추가 중" : "사용자 추가"}
            </button>
            <button
              type="button"
              className="btn-outline text-sm"
              onClick={reset}
              disabled={isPending}
            >
              초기화
            </button>
            <span className="text-[11px] text-muted">
              운영자 사유 = &quot;운영자 콘솔에서 직접 추가&quot; · agreedTermsVersion=1.0 · autoVerified=true.
            </span>
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">
          펼치기를 눌러 이메일·비밀번호·UUID 로 신규 사용자를 즉시 추가하세요. 기존
          <Link href="/dashboard/users/new" className="ml-1 underline">전체 가입 페이지</Link>도 그대로 사용 가능합니다.
        </p>
      )}
    </PanelCard>
  );
}

// Phase 10-C — Server `/api/v1/admin/users` 실 사용자 목록 패널.
// 가짜 구현 카탈로그 #1 (users import) 의 1차 wiring — 페이지 본문 통계는 mock
// 유지하되 상단에 Server 실 데이터를 우선 노출. 다음 라운드에 DataTable rows 까지 swap.
//
// 2026-05-28 — 자동 새로고침 추가 (useAutoRefresh, 기본 10s + visibility-aware).
// APP 회원가입 → SERVER 적재 → ADMIN 즉시 표시 흐름 확인용. 운영자가 토글로 활성화.
function LiveUsersPanel() {
  const [items, setItems] = useState<ServerUserRow[] | null>(null);
  const [total, setTotal] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoOn, setAutoOn] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  // 새로 들어온 사용자 ID 추적 — highlight 표시용. row mount 시 1초 후 클리어.
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  async function fetchOnce(): Promise<boolean> {
    const r = await listUsersAction({ limit: 20 });
    if (!r.ok) {
      setError(r.message);
      return false;
    }
    setError(null);
    setItems(r.users);
    setTotal(r.total);
    // diff 로 신규 사용자 식별 (최초 로딩은 highlight 생략).
    const incoming = new Set(r.users.map((u) => u.id));
    if (firstLoadRef.current) {
      firstLoadRef.current = false;
    } else {
      const added: string[] = [];
      incoming.forEach((id) => {
        if (!knownIdsRef.current.has(id)) added.push(id);
      });
      if (added.length > 0) {
        setNewIds((prev) => {
          const next = new Set(prev);
          added.forEach((id) => next.add(id));
          return next;
        });
        // 1.2s 후 highlight 해제 (CSS animation 1s + 여유).
        setTimeout(() => {
          setNewIds((prev) => {
            const next = new Set(prev);
            added.forEach((id) => next.delete(id));
            return next;
          });
        }, 1200);
      }
    }
    knownIdsRef.current = incoming;
    return true;
  }

  useEffect(() => {
    void fetchOnce().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useAutoRefresh(fetchOnce, {
    intervalMs: 10000,
    enabled: autoOn,
    maxFailures: 3,
    onResult: ({ ok }) => {
      if (!ok) setToast("일시 연결 끊김 — 다음 갱신에서 재시도");
    },
    onMaxFailures: () => {
      setAutoOn(false);
      setToast("자동 갱신 중지 — 3회 연속 실패로 폴링을 중단했습니다.");
    },
  });

  return (
    <PanelCard
      title={loading ? "실시간 사용자 (Server) 로딩 중" : `실시간 사용자 (Server) — 총 ${total.toLocaleString()}명`}
      description="현재 활성 세션을 포함한 사용자 정보를 실시간으로 표시합니다. 모든 PII 접근은 감사 로그에 자동 기록됩니다."
      actions={
        <AutoRefreshToggle
          enabled={autoOn}
          onToggle={setAutoOn}
          lastRefreshedAt={refresh.lastRefreshedAt}
        />
      }
    >
      {loading ? (
        <div className="text-sm text-muted">불러오는 중</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Server 도달 실패: {error}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="text-sm text-muted">등록된 사용자가 없습니다.</div>
      ) : (
        <ul className="space-y-1" data-testid="live-users-list">
          {items.slice(0, 20).map((u) => (
            <li
              key={u.id}
              className={
                "rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-xs " +
                (newIds.has(u.id) ? "row-new-highlight" : "")
              }
              data-testid={newIds.has(u.id) ? "user-row-new" : "user-row"}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono">{u.email}</span>
                <span
                  className={
                    u.account_status === "active"
                      ? "chip chip-success"
                      : u.account_status === "paused"
                        ? "chip chip-warn"
                        : "chip chip-error"
                  }
                >
                  {u.account_status ?? "active"}
                </span>
                {u.totp_enabled ? <span className="chip chip-info">2FA</span> : null}
              </div>
              <div className="mt-1 text-muted">
                가입 {u.created_at ?? "—"} · 마지막 로그인 {u.last_login_at ?? "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
      {toast ? (
        <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 flex items-start gap-3">
          <span className="flex-1">{toast}</span>
          <button
            type="button"
            className="underline text-amber-800"
            onClick={() => setToast(null)}
          >
            닫기
          </button>
        </div>
      ) : null}
    </PanelCard>
  );
}

// V2.0 #15 — Server `/api/v1/admin/users/pipa` (Phase2-A) 실 연동 패널.
// 기존 users 기반 pipaTrackList 와 병존 — Server 도달 시 실 데이터 표시.
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
      description="탈퇴 대기·최근 데이터 내보내기 요청을 표시합니다. 최고관리자 전용."
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
