"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { ExpandableRow } from "../_components/ExpandableRow";
import { DangerConfirmDialog } from "../_components/DangerConfirmDialog";
import {
  listNoticesAction,
  createNoticeAction,
  deleteNoticeAction,
  type NoticesListResult,
  type NoticeMutationResult,
} from "@/lib/actions/noticesActions";
import type { NoticeRow } from "@/lib/adminApi";

// Phase 15 — notices CRUD wiring.
// Server `GET/POST/PATCH/DELETE /api/v1/admin/notices` (Notice prisma model + migration 20260521100000).
//
// 2026-06-02 UX 통합:
// - 행 클릭(펼침 버튼)으로 본문/스케줄/대상자 펼침 (error-tracking 패턴, ExpandableRow 공통화).
// - 강력액션(삭제) 라벨 통일 + DangerConfirmDialog 색상 강조 모달.

const AUDIENCES = ["all", "owner", "operator", "beta"] as const;

export default function NoticesPage() {
  const [state, setState] = useState<NoticesListResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [creating, startCreate] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<NoticeRow | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);

  function reload() {
    startLoad(async () => {
      const r = await listNoticesAction();
      setState(r);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const title = String(fd.get("title") || "").trim();
    const body = String(fd.get("body") || "").trim();
    const audience = String(fd.get("audience") || "all");
    startCreate(async () => {
      const r: NoticeMutationResult = await createNoticeAction({ title, body, audience });
      if (!r.ok) {
        setToast(`작성 실패: ${r.message}`);
        return;
      }
      setToast(`공지 작성됨: ${r.notice.id}`);
      e.currentTarget?.reset?.();
      reload();
    });
  }

  async function confirmDelete() {
    if (!deleting) return;
    setDeletingBusy(true);
    const r = await deleteNoticeAction({ id: deleting.id });
    setDeletingBusy(false);
    if (!r.ok) {
      setToast(`삭제 실패: ${r.message}`);
      return;
    }
    setToast("삭제됨");
    setDeleting(null);
    reload();
  }

  const items: NoticeRow[] = state && state.ok ? state.items : [];

  return (
    <div className="space-y-6">
      <PanelCard title="공지·배너 작성">
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            name="title"
            placeholder="제목 (2자 이상)"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            required
          />
          <textarea
            name="body"
            placeholder="본문 (5자 이상)"
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            required
          />
          <div className="flex items-center gap-2">
            <select
              name="audience"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              defaultValue="all"
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={creating}
              className="rounded-xl bg-accent px-4 py-2 text-sm text-white shadow-card disabled:opacity-60"
            >
              {creating ? "작성 중..." : "작성"}
            </button>
          </div>
        </form>
      </PanelCard>

      <PanelCard
        title="공지·배너 목록"
        description="행을 펼침으로 본문·발송 일정·대상자를 확인합니다."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        {!state ? (
          <div className="text-sm text-muted">불러오는 중</div>
        ) : !state.ok ? (
          <div className="text-sm text-muted">공지가 없습니다.</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted">공지가 없습니다.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((n) => {
              const isOpen = expandedId === n.id;
              return (
                <ExpandableRow
                  key={n.id}
                  expanded={isOpen}
                  onToggle={() => setExpandedId(isOpen ? null : n.id)}
                  summary={
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 truncate">{n.title}</span>
                        <span className="chip chip-muted">{n.audience}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-muted">
                        created {n.created_at}
                        {n.scheduled_at ? ` · scheduled ${n.scheduled_at}` : ""}
                        {n.expires_at ? ` · expires ${n.expires_at}` : ""}
                      </div>
                    </div>
                  }
                  detail={
                    <div className="space-y-2">
                      <div>
                        <div className="text-[11px] text-muted mb-1">본문</div>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{n.body}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div>
                          <span className="text-muted">대상자: </span>
                          <span className="font-medium">{n.audience}</span>
                        </div>
                        <div>
                          <span className="text-muted">ID: </span>
                          <span className="font-mono text-[10px]">{n.id}</span>
                        </div>
                        <div>
                          <span className="text-muted">발송 예약: </span>
                          <span>{n.scheduled_at ?? "—"}</span>
                        </div>
                        <div>
                          <span className="text-muted">만료: </span>
                          <span>{n.expires_at ?? "—"}</span>
                        </div>
                      </div>
                    </div>
                  }
                  trailing={
                    <button
                      type="button"
                      onClick={() => setDeleting(n)}
                      title="공지 영구 삭제"
                      className="rounded-lg bg-red-50 border border-red-300 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                    >
                      삭제
                    </button>
                  }
                />
              );
            })}
          </ul>
        )}
      </PanelCard>

      <DangerConfirmDialog
        open={!!deleting}
        title="공지·배너 삭제"
        description={
          deleting
            ? `"${deleting.title}" 공지를 영구 삭제합니다.`
            : "공지를 영구 삭제합니다."
        }
        detail={
          deleting ? (
            <span>
              대상자 <b>{deleting.audience}</b> · 작성일 {deleting.created_at}
            </span>
          ) : null
        }
        confirmLabel="삭제"
        busy={deletingBusy}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (deletingBusy) return;
          setDeleting(null);
        }}
      />

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card">
          {toast}
          <button
            className="ml-3 underline opacity-80"
            onClick={() => setToast(null)}
            type="button"
          >
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}
