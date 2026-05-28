"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
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

const AUDIENCES = ["all", "owner", "operator", "beta"] as const;

export default function NoticesPage() {
  const [state, setState] = useState<NoticesListResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [creating, startCreate] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

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

  async function handleDelete(id: string) {
    if (typeof window !== "undefined" && !window.confirm("이 공지를 삭제하시겠습니까?")) return;
    const r = await deleteNoticeAction({ id });
    if (!r.ok) {
      setToast(`삭제 실패: ${r.message}`);
      return;
    }
    setToast("삭제됨");
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
            {items.map((n) => (
              <li
                key={n.id}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{n.title}</div>
                  <div className="text-xs text-muted line-clamp-2">{n.body}</div>
                  <div className="mt-1 text-[11px] text-muted">
                    <span className="chip chip-muted">{n.audience}</span>
                    {" · "}created {n.created_at}
                    {n.scheduled_at ? ` · scheduled ${n.scheduled_at}` : ""}
                    {n.expires_at ? ` · expires ${n.expires_at}` : ""}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(n.id)}
                  className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700 shrink-0"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

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
