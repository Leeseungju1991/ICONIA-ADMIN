"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import type { AdminFeedPostRow, AdminFeedPostDetail } from "@/lib/adminApi";
import {
  listFeedPostsAction,
  getFeedPostAction,
  patchFeedPostAction,
  deleteFeedPostAction,
} from "@/lib/actions/feed";

// (주)숨코리아 출시 정비 — 피드 관리 (Feed).
//
// Server `/api/v1/admin/feed/posts*` (requireAdmin) — SERVER 동시 작업으로 추가.
// SERVER 미배포 단계에서도 페이지 자체는 정상 렌더 — error.unreachable 분기로
// "준비 중" 안내 + 빈 테이블. 사용자는 다른 메뉴로 이동 가능해야 함.

const PAGE_SIZE = 25;

type FeedError = { message: string; unreachable: boolean } | null;

function classifyError(message: string): FeedError {
  const unreachable =
    message.startsWith("ERR_NETWORK") ||
    message.startsWith("ERR_SERVER_UNAVAILABLE") ||
    message.includes("not_found") ||
    message.includes("준비") ||
    message === "Not Found";
  return { message, unreachable };
}

export default function FeedPage() {
  const [items, setItems] = useState<AdminFeedPostRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [hidden, setHidden] = useState<"all" | "true" | "false">("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [error, setError] = useState<FeedError>(null);
  const [loading, startLoad] = useTransition();
  const [picked, setPicked] = useState<AdminFeedPostRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(() => {
    startLoad(async () => {
      const r = await listFeedPostsAction({
        q: q.trim() || undefined,
        hidden,
        from: from || undefined,
        to: to || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      if (!r.ok) {
        setError(classifyError(r.message));
        setItems([]);
        setTotal(0);
      } else {
        setError(null);
        setItems(r.data.items ?? []);
        setTotal(r.data.total ?? 0);
      }
    });
  }, [q, hidden, from, to, page]);

  useEffect(() => {
    reload();
  }, [reload]);

  const summary = useMemo(() => {
    const visible = items.filter((i) => !i.is_hidden).length;
    const hiddenCount = items.filter((i) => i.is_hidden).length;
    const comments = items.reduce((s, i) => s + (i.comments_count ?? 0), 0);
    return { visible, hidden: hiddenCount, comments, total };
  }, [items, total]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleToggleHide(p: AdminFeedPostRow) {
    const r = await patchFeedPostAction({ id: p.id, is_hidden: !p.is_hidden });
    if (!r.ok) {
      setToast(`상태 변경 실패: ${r.message}`);
      return;
    }
    setToast(`게시물 ${p.id} ${p.is_hidden ? "복구" : "숨김"} 완료.`);
    reload();
  }

  async function handleDelete(p: AdminFeedPostRow) {
    if (typeof window !== "undefined") {
      const phrase = window.prompt(
        `게시물 삭제 (soft delete)\n\n실행하려면 정확히 "DELETE" 를 입력하세요.`,
      );
      if (phrase !== "DELETE") {
        setToast("실행 취소 — 확인 문구 불일치.");
        return;
      }
    }
    const r = await deleteFeedPostAction({ id: p.id });
    if (!r.ok) {
      setToast(`삭제 실패: ${r.message}`);
      return;
    }
    setPicked(null);
    setToast(`게시물 ${p.id} 삭제 완료.`);
    reload();
  }

  type Row = AdminFeedPostRow;
  const columns: Column<Row>[] = [
    {
      key: "id",
      header: "ID",
      render: (r) => <span className="font-mono text-[11px]">{r.id}</span>,
    },
    {
      key: "author",
      header: "작성자",
      render: (r) => <span className="font-mono text-xs">{r.author_handle ?? r.author_id}</span>,
    },
    {
      key: "body",
      header: "본문 미리보기",
      render: (r) => (
        <span className="text-slate-700 line-clamp-1 max-w-[320px] inline-block align-middle">
          {r.body_excerpt || r.body}
        </span>
      ),
    },
    { key: "comments", header: "댓글", align: "right", render: (r) => r.comments_count },
    {
      key: "hidden",
      header: "숨김",
      render: (r) =>
        r.is_hidden ? (
          <span className="chip chip-error">숨김</span>
        ) : (
          <span className="chip chip-success">노출</span>
        ),
    },
    {
      key: "created",
      header: "작성일",
      render: (r) => <span className="text-xs text-muted">{r.created_at}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex gap-1 justify-end">
          <button
            className="btn-outline text-xs"
            type="button"
            onClick={() => handleToggleHide(r)}
          >
            {r.is_hidden ? "복구" : "숨김"}
          </button>
          <button className="btn-outline text-xs" type="button" onClick={() => setPicked(r)}>
            상세
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="현재 페이지 노출" value={String(summary.visible)} hint="is_hidden=false" accent="teal" />
        <StatCard label="현재 페이지 숨김" value={String(summary.hidden)} hint="is_hidden=true" accent="pink" />
        <StatCard label="현재 페이지 댓글 합" value={String(summary.comments)} hint="comments_count 합산" accent="blue" />
        <StatCard label="전체 게시물 (서버)" value={String(total)} hint="Server total" accent="orange" />
      </section>

      <PanelCard
        title="피드 게시물 (Server 정본)"
        description="Server /api/v1/admin/feed/posts — paginated. 숨김 토글·삭제는 Server mutation."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        <form
          className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-4"
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            reload();
          }}
        >
          <input
            type="text"
            placeholder="검색 (작성자/본문)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="sm:col-span-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <select
            value={hidden}
            onChange={(e) => {
              setHidden(e.target.value as "all" | "true" | "false");
              setPage(1);
            }}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="all">전체</option>
            <option value="false">노출만</option>
            <option value="true">숨김만</option>
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="시작일"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            aria-label="종료일"
          />
          <button
            type="submit"
            className="sm:col-span-5 sm:w-auto sm:justify-self-end rounded-lg bg-slate-900 text-white text-xs px-3 py-2"
          >
            검색 적용
          </button>
        </form>

        <DataTable
          columns={columns}
          rows={items.map((p) => ({ ...p }))}
          rowKey={(r) => r.id}
          empty="해당 조건의 게시물이 없습니다."
          pageSize={0}
        />

        <div className="mt-3 flex items-center justify-between text-xs text-muted">
          <span>
            전체 {total.toLocaleString()}건 · {page} / {totalPages} 페이지
          </span>
          <div className="flex items-center gap-1">
            <button
              className="rounded-lg px-2.5 py-1 bg-white/60 border border-white/60 disabled:opacity-40"
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              이전
            </button>
            <button
              className="rounded-lg px-2.5 py-1 bg-white/60 border border-white/60 disabled:opacity-40"
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              다음
            </button>
          </div>
        </div>
      </PanelCard>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card max-w-md">
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">
            닫기
          </button>
        </div>
      ) : null}

      {picked ? (
        <FeedDetailDrawer
          post={picked}
          onClose={() => setPicked(null)}
          onDelete={() => handleDelete(picked)}
          onAfterPatch={() => {
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function FeedDetailDrawer({
  post,
  onClose,
  onDelete,
  onAfterPatch,
}: {
  post: AdminFeedPostRow;
  onClose: () => void;
  onDelete: () => void;
  onAfterPatch: () => void;
}) {
  const [detail, setDetail] = useState<AdminFeedPostDetail | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(post.body);
  const [err, setErr] = useState<string | null>(null);
  const [busy, startBusy] = useTransition();

  useEffect(() => {
    startBusy(async () => {
      const r = await getFeedPostAction({ id: post.id });
      if (r.ok) {
        setDetail(r.data);
        setDraft(r.data.post.body);
      } else {
        setErr(r.message);
      }
    });
  }, [post.id]);

  function save() {
    startBusy(async () => {
      const r = await patchFeedPostAction({ id: post.id, body: draft });
      if (!r.ok) {
        setErr(`수정 실패: ${r.message}`);
        return;
      }
      setEditing(false);
      setErr(null);
      onAfterPatch();
    });
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/30">
      <div className="w-full max-w-lg glass-panel rounded-3xl p-6 relative max-h-[90vh] overflow-y-auto">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">피드 게시물 상세</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{post.id}</p>

        {err ? (
          <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {err}
          </div>
        ) : null}

        <div className="mt-5 space-y-3 text-sm">
          <div className="rounded-xl bg-white/60 border border-white/60 p-3">
            <div className="text-xs text-muted mb-1">본문</div>
            {editing ? (
              <textarea
                className="w-full rounded-lg border border-slate-300 p-2 text-sm min-h-[120px]"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            ) : (
              <p className="text-sm text-slate-800 whitespace-pre-wrap">
                {detail?.post.body ?? post.body}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="작성자">
              <span className="font-mono">{post.author_handle ?? post.author_id}</span>
            </Field>
            <Field label="작성일">{post.created_at}</Field>
            <Field label="댓글">{detail?.comments.length ?? post.comments_count}</Field>
            <Field label="상태">
              {post.is_hidden ? (
                <span className="chip chip-error">숨김</span>
              ) : (
                <span className="chip chip-success">노출</span>
              )}
            </Field>
          </div>

          <div className="mt-4">
            <div className="text-xs text-muted mb-2">댓글 ({detail?.comments.length ?? 0})</div>
            {busy && !detail ? (
              <div className="text-xs text-muted">로딩...</div>
            ) : detail && detail.comments.length === 0 ? (
              <div className="text-xs text-muted">댓글 없음.</div>
            ) : (
              <ul className="space-y-2">
                {detail?.comments.map((c) => (
                  <li key={c.id} className="rounded-lg bg-white/55 border border-white/50 p-2">
                    <div className="flex items-center justify-between text-[11px] text-muted">
                      <span className="font-mono">{c.author_handle ?? c.author_id}</span>
                      <span>{c.created_at}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-700">{c.body}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {editing ? (
            <>
              <button className="btn-primary text-sm" type="button" onClick={save} disabled={busy}>
                저장
              </button>
              <button
                className="btn-outline text-sm"
                type="button"
                onClick={() => {
                  setEditing(false);
                  setDraft(detail?.post.body ?? post.body);
                }}
              >
                취소
              </button>
            </>
          ) : (
            <>
              <button className="btn-outline text-sm" type="button" onClick={() => setEditing(true)}>
                본문 수정
              </button>
              <button className="btn-danger text-sm" type="button" onClick={onDelete}>
                삭제
              </button>
            </>
          )}
        </div>
        <p className="text-[11px] text-muted mt-3">
          ※ 삭제는 soft delete. DELETE 확인 문구 필수. Server audit_log 자동 기록.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/55 border border-white/50 px-3 py-2">
      <div className="text-[10px] text-muted">{label}</div>
      <div className="text-sm text-slate-800 font-medium">{children}</div>
    </div>
  );
}
