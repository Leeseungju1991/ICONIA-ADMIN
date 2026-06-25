"use client";

// 2026-06-16 — 차단 사용자 관리 (◈차단 라운드).
// GET  /api/v1/admin/users/:userId/blocked-users?query=&sort=created_at|display_name
// POST /api/v1/admin/users/:userId/unblock  body={target_user_id}
// 특정 사용자의 차단 목록을 조회(정렬/검색)하고 개별 차단을 해제한다.

import { useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { AdminToast, useAdminToast } from "../_components/AdminToast";
import { StatCard } from "../_components/StatCard";
import { EmptyState, ErrorState, LoadingState } from "../_components/CardStates";
import {
  listBlockedUsersAction,
  unblockUserAction,
} from "@/lib/actions/blockedUsers";
import type { BlockedUserRow, BlockedUserSort } from "@/types/admin-api";
import { safeImgSrc } from "@/lib/safeUrl";

const SORT_LABEL: Record<BlockedUserSort, string> = {
  created_at: "차단 최신순",
  display_name: "이름순",
};

export default function BlockedUsersPage() {
  const [userId, setUserId] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<BlockedUserSort>("created_at");
  const [items, setItems] = useState<BlockedUserRow[] | null>(null);
  const [error, setError] = useState<{ message: string; unreachable: boolean } | null>(null);
  const { toast, setToast } = useAdminToast();
  const [loading, startLoad] = useTransition();
  const [acting, startAct] = useTransition();

  function reload() {
    const uid = userId.trim();
    if (!uid) {
      setToast("조회할 사용자 ID 를 입력하세요.");
      return;
    }
    startLoad(async () => {
      const r = await listBlockedUsersAction({
        userId: uid,
        query: query.trim() || undefined,
        sort,
      });
      if (!r.ok) {
        setError({ message: r.message, unreachable: !!r.unreachable });
        setItems(null);
        return;
      }
      setError(null);
      setItems(r.data.items);
    });
  }

  const list: BlockedUserRow[] = useMemo(() => items ?? [], [items]);

  function handleUnblock(target: BlockedUserRow) {
    const uid = userId.trim();
    if (!uid) return;
    const ok = window.confirm(
      `차단 해제\n\n대상: ${target.display_name || target.target_user_id}\n이 사용자의 차단을 해제하시겠습니까?`,
    );
    if (!ok) return;
    startAct(async () => {
      const res = await unblockUserAction({ userId: uid, targetUserId: target.target_user_id });
      if (!res.ok) {
        setToast({ message: `차단 해제 실패: ${res.message}`, tone: "error" });
        return;
      }
      setToast({ message: `차단 해제 완료 — ${target.display_name || target.target_user_id}`, tone: "success" });
      // 목록에서 즉시 제거 (낙관적) 후 재조회.
      setItems((cur) =>
        (cur ?? []).filter((b) => b.target_user_id !== target.target_user_id),
      );
      reload();
    });
  }

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          label="차단 수"
          value={items ? list.length.toLocaleString() : "—"}
          hint={items ? "현재 조회 기준" : "사용자 ID 조회 전"}
          accent="pink"
        />
        <StatCard
          label="조회 대상"
          value={userId.trim() ? "지정됨" : "미지정"}
          hint="특정 사용자 UUID"
          accent="blue"
        />
        <StatCard
          label="정렬"
          value={SORT_LABEL[sort]}
          hint="created_at / display_name"
          accent="teal"
        />
      </section>

      <PanelCard
        title="차단 사용자 목록"
        description="특정 사용자가 차단한 사용자들을 조회하고, 필요 시 개별 차단을 해제합니다."
      >
        <form
          className="flex flex-wrap items-end gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            reload();
          }}
        >
          <label className="flex flex-col gap-1 min-w-[220px] flex-1">
            <span className="text-xs text-slate-500">사용자 ID (UUID)</span>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="차단 목록을 볼 사용자 ID"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <label className="flex flex-col gap-1 min-w-[160px] flex-1">
            <span className="text-xs text-slate-500">검색 (이름·이메일)</span>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="대상 검색어"
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">정렬</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as BlockedUserSort)}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-accent/40"
            >
              <option value="created_at">{SORT_LABEL.created_at}</option>
              <option value="display_name">{SORT_LABEL.display_name}</option>
            </select>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-accent text-white px-4 py-1.5 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "조회 중..." : "조회"}
          </button>
        </form>

        {error ? (
          <ErrorState message={error.message} unreachable={error.unreachable} onRetry={reload} />
        ) : items === null ? (
          <EmptyState title="사용자 ID 를 입력하고 조회하세요" hint="해당 사용자의 차단 목록이 표시됩니다." />
        ) : list.length === 0 ? (
          <EmptyState title="차단한 사용자 없음" hint="이 사용자는 아무도 차단하지 않았습니다." />
        ) : loading ? (
          <LoadingState />
        ) : (
          <ul className="space-y-2">
            {list.map((b) => (
              <BlockedRow
                key={b.target_user_id}
                row={b}
                onUnblock={() => handleUnblock(b)}
                disabled={acting}
              />
            ))}
          </ul>
        )}
      </PanelCard>

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function BlockedRow({
  row,
  onUnblock,
  disabled,
}: {
  row: BlockedUserRow;
  onUnblock: () => void;
  disabled: boolean;
}) {
  return (
    <li className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
      <div className="min-w-0 flex-1 flex items-center gap-3">
        {safeImgSrc(row.avatar_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeImgSrc(row.avatar_url)}
            alt=""
            className="h-9 w-9 rounded-full object-cover bg-slate-100 shrink-0"
          />
        ) : (
          <div className="h-9 w-9 rounded-full bg-slate-100 shrink-0 flex items-center justify-center text-slate-400 text-sm">
            {(row.display_name || "?").slice(0, 1)}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-sm font-medium text-slate-900 truncate">
            {row.display_name || "(이름 없음)"}
          </div>
          <div className="text-[11px] text-slate-500 truncate">
            {row.email ? `${row.email} · ` : ""}
            <span className="font-mono">{row.target_user_id}</span>
          </div>
          <div className="text-[11px] text-slate-400">
            차단 {new Date(row.created_at).toLocaleString("ko-KR")}
          </div>
        </div>
      </div>
      <button
        type="button"
        onClick={onUnblock}
        disabled={disabled}
        className="rounded-lg bg-white border border-slate-300 px-3 py-1.5 text-xs hover:bg-slate-50 disabled:opacity-60 shrink-0"
      >
        차단 해제
      </button>
    </li>
  );
}
