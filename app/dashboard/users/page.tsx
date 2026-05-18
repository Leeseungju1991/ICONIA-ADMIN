"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { mockUsers, formatDate, type UserRow } from "@/lib/mockData";

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

  const columns: Column<UserRow>[] = [
    { key: "id", header: "ID", render: (r) => <span className="font-mono text-xs text-muted">{r.id}</span> },
    { key: "name", header: "이름", render: (r) => <span className="font-medium text-slate-800">{r.display_name}</span> },
    { key: "email", header: "이메일", render: (r) => r.email },
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
      <PanelCard
        title="회원 검색"
        description="이메일·이름·ID로 회원을 찾고 상세 정보 및 운영자 액션을 수행합니다."
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

      {selected ? <UserDetailDrawer user={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

function UserDetailDrawer({ user, onClose }: { user: UserRow; onClose: () => void }) {
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
        <p className="text-xs text-muted mt-0.5">{user.id}</p>

        <dl className="mt-5 space-y-3 text-sm">
          <Row k="이름" v={user.display_name} />
          <Row k="이메일" v={user.email} />
          <Row k="상태" v={<span className={statusChip[user.account_status]}>{statusLabel[user.account_status]}</span>} />
          <Row k="MFA" v={user.totp_enabled ? "활성화" : "비활성"} />
          <Row k="보유 인형" v={`${user.doll_count}개`} />
          <Row k="가입일" v={formatDate(user.created_at)} />
          <Row k="최근 로그인" v={formatDate(user.last_login_at)} />
        </dl>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-outline text-sm" type="button">강제 로그아웃</button>
          <button className="btn-outline text-sm" type="button">계정 일시정지</button>
          <button className="btn-outline text-sm" type="button">MFA 초기화</button>
          <button className="btn-danger text-sm" type="button">탈퇴 처리</button>
        </div>
        <p className="text-[11px] text-muted mt-3">※ 데모 환경 — 액션 실행은 백엔드 연동 시 활성화됩니다.</p>
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
