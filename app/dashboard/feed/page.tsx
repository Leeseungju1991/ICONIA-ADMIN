"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { AutoRefreshToggle } from "../_components/AutoRefreshToggle";
import { useAutoRefresh } from "@/lib/hooks/useAutoRefresh";
import type { AdminFeedPostRow, AdminFeedPostDetail, AdminFeedMedia } from "@/lib/adminApi";
import {
  listFeedPostsAction,
  getFeedPostAction,
  patchFeedPostAction,
  deleteFeedPostAction,
  bulkAttachFeedMediaAction,
} from "@/lib/actions/feed";

// 피드 관리 (Feed).
// 게시물 검색 / 숨김·복구 / 삭제 (soft) / 상세 + 댓글 미리보기.

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
  const searchParams = useSearchParams();
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
  // 2026-05-28 — 자동 새로고침 (visibility-aware, 10s 기본).
  const [autoOn, setAutoOn] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const knownIdsRef = useRef<Set<string>>(new Set());
  const firstLoadRef = useRef(true);

  // 새 게시물 생성 페이지에서 돌아온 경우 — flash 토스트.
  useEffect(() => {
    const created = searchParams?.get("created");
    if (created) {
      setToast(`게시물 발행 완료 (ID: ${created.slice(0, 12)}…). 감사 로그에 기록되었습니다.`);
    }
  }, [searchParams]);

  const reload = useCallback((): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
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
          resolve(false);
        } else {
          setError(null);
          const incoming = r.data.items ?? [];
          setItems(incoming);
          setTotal(r.data.total ?? 0);
          const incomingIds = new Set(incoming.map((p) => p.id));
          if (firstLoadRef.current) {
            firstLoadRef.current = false;
          } else {
            const added: string[] = [];
            incomingIds.forEach((id) => {
              if (!knownIdsRef.current.has(id)) added.push(id);
            });
            if (added.length > 0) {
              setNewIds((prev) => {
                const next = new Set(prev);
                added.forEach((id) => next.add(id));
                return next;
              });
              setTimeout(() => {
                setNewIds((prev) => {
                  const next = new Set(prev);
                  added.forEach((id) => next.delete(id));
                  return next;
                });
              }, 1200);
            }
          }
          knownIdsRef.current = incomingIds;
          resolve(true);
        }
      });
    });
  }, [q, hidden, from, to, page]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const refresh = useAutoRefresh(reload, {
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
      header: "이메일",
      // 2026-06-04 — 사용자 요청: ID 컬럼을 작성자 이메일로 표시.
      // 서버가 author_email 을 채워 보내면 그것을, 미반영시 fallback 으로 author_id.
      render: (r) => (
        <span className="text-[12px] text-slate-800 inline-flex items-center gap-1.5">
          {newIds.has(r.id) ? (
            <span
              className="chip chip-success"
              data-testid="feed-row-new"
              aria-label="신규 게시물"
            >
              NEW
            </span>
          ) : null}
          <span
            className={newIds.has(r.id) ? "row-new-highlight inline-block px-1 rounded" : ""}
            title={r.id}
          >
            {r.author_email ?? r.author_id}
          </span>
        </span>
      ),
    },
    {
      key: "media",
      header: "미디어",
      render: (r) => <FeedRowThumb post={r} />,
    },
    {
      key: "author",
      header: "작성자",
      // 2026-06-04 — 사용자 요청: 작성자 컬럼은 표시이름. 클릭 시 사용자 상세로 이동.
      render: (r) => (
        <Link
          href={`/dashboard/users/${r.author_id}`}
          className="text-[12px] text-slate-800 hover:text-accent hover:underline"
          title={r.author_id}
        >
          {r.author_display_name ?? r.author_handle ?? r.author_id}
        </Link>
      ),
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
      <div className="flex justify-end">
        <Link
          href="/dashboard/feed/new"
          className="rounded-xl bg-accent px-3 py-2 text-sm text-white font-medium hover:opacity-90"
          data-testid="link-new-feed-post"
        >
          + 새 게시물
        </Link>
      </div>

      <BulkAttachMediaPanel
        onDone={(msg) => {
          setToast(msg);
          void reload();
        }}
      />
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="현재 페이지 노출" value={String(summary.visible)} accent="teal" />
        <StatCard label="현재 페이지 숨김" value={String(summary.hidden)} accent="pink" />
        <StatCard label="현재 페이지 댓글 합" value={String(summary.comments)} accent="blue" />
        <StatCard label="전체 게시물" value={String(total)} accent="orange" />
      </section>

      {error?.unreachable ? (
        <div
          role="status"
          className="rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-800"
        >
          <span className="font-semibold mr-2">준비 중</span>
          <span className="text-amber-700">
            Server 피드 엔드포인트가 아직 응답하지 않습니다. 다른 메뉴는 정상 이용 가능합니다.
          </span>
        </div>
      ) : null}

      <PanelCard
        title="피드 게시물"
        actions={
          <>
            <AutoRefreshToggle
              enabled={autoOn}
              onToggle={setAutoOn}
              lastRefreshedAt={refresh.lastRefreshedAt}
            />
            <button
              type="button"
              onClick={() => {
                void reload();
              }}
              disabled={loading}
              className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
            >
              {loading ? "조회 중..." : "새로고침"}
            </button>
          </>
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
          <FeedMediaGrid media={detail?.post.media ?? post.media ?? []} />
          <div className="grid grid-cols-2 gap-2 text-xs">
            <Field label="작성자">
              {/* 2026-06-04 — 사용자 요청: 이메일·표시이름 노출. 클릭 → 사용자 상세. */}
              <Link
                href={`/dashboard/users/${post.author_id}`}
                className="text-[12px] text-slate-800 hover:text-accent hover:underline break-all flex flex-col"
                title={post.author_id}
              >
                <span className="font-medium">
                  {post.author_display_name ?? post.author_handle ?? "(이름 없음)"}
                </span>
                <span className="text-[11px] text-muted">
                  {post.author_email ?? post.author_id}
                </span>
              </Link>
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
                      {/* 2026-06-02 — 작성자 표시 ID만. */}
                      <span className="font-mono">{c.author_id}</span>
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
      </div>
    </div>
  );
}

// 2026-06-01 P0 fix #2 — 피드 리스트 row 의 미디어 썸네일 미니 셀.
// thumbnail_url > 첫 image url > 비디오 카운트 표시. onError → placeholder.
function FeedRowThumb({ post }: { post: AdminFeedPostRow }) {
  const media = post.media ?? [];
  const thumb = post.thumbnail_url
    || media.find((m) => m.kind === "image")?.thumbnail_url
    || media.find((m) => m.kind === "image")?.url
    || media.find((m) => m.kind === "video")?.thumbnail_url
    || null;
  const count = post.media_count ?? media.length;
  if (!thumb && count === 0) {
    return <span className="text-[10px] text-slate-300">—</span>;
  }
  return (
    <div className="inline-flex items-center gap-1.5">
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumb}
          alt=""
          className="w-10 h-10 rounded-md object-cover bg-slate-100"
          loading="lazy"
          onError={(e) => {
            const t = e.currentTarget;
            t.style.display = "none";
            const sib = t.nextElementSibling as HTMLElement | null;
            if (sib) sib.style.display = "inline-flex";
          }}
        />
      ) : null}
      <span
        className="w-10 h-10 rounded-md bg-slate-100 text-[10px] text-slate-400 items-center justify-center"
        style={{ display: thumb ? "none" : "inline-flex" }}
      >
        n/a
      </span>
      {count > 1 ? (
        <span className="chip chip-info text-[10px]">+{count - 1}</span>
      ) : null}
    </div>
  );
}

// 피드 상세 미디어 그리드 — image=썸네일 클릭=원본 열기, video=video tag.
// url 이 dead-link 일 가능성 대비 onError 처리.
function FeedMediaGrid({ media }: { media: AdminFeedMedia[] }) {
  if (!media || media.length === 0) {
    return (
      <div className="rounded-xl bg-white/60 border border-white/60 p-3">
        <div className="text-xs text-muted">첨부 미디어 없음.</div>
      </div>
    );
  }
  return (
    <div className="rounded-xl bg-white/60 border border-white/60 p-3">
      <div className="text-xs text-muted mb-2">미디어 ({media.length})</div>
      <div className="grid grid-cols-3 gap-2">
        {media.map((m) => (
          <div
            key={m.id}
            className="aspect-square rounded-lg overflow-hidden bg-slate-100 border border-slate-200 relative"
          >
            {m.kind === "video" ? (
              m.url ? (
                <video
                  src={m.url}
                  poster={m.thumbnail_url ?? undefined}
                  controls
                  preload="metadata"
                  className="w-full h-full object-cover bg-black"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                  video (no url)
                </div>
              )
            ) : m.url || m.thumbnail_url ? (
              <a
                href={m.url ?? m.thumbnail_url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full h-full"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={m.thumbnail_url ?? m.url ?? ""}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    const t = e.currentTarget;
                    t.style.display = "none";
                    const sib = t.nextElementSibling as HTMLElement | null;
                    if (sib) sib.style.display = "flex";
                  }}
                />
                <div
                  className="absolute inset-0 items-center justify-center text-[10px] text-slate-400 bg-slate-100"
                  style={{ display: "none" }}
                >
                  이미지 로드 실패
                </div>
              </a>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400">
                {m.storage_key ? "키만 존재" : "URL 없음"}
              </div>
            )}
            <span className="absolute bottom-1 right-1 chip chip-info text-[10px]">
              {m.kind}
            </span>
          </div>
        ))}
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

// 2026-06-04 — 사용자 요청: 미디어가 없는 모든 게시물에 placeholder 미디어를
// 일괄 주입. 이미지(1장) / 이미지 여러장(3장) / 동영상 중 선택. server
// POST /api/v1/admin/feed/posts/bulk-attach-media 호출. 기존 미디어 있는 게시물
// 은 건드리지 않음 (server 측 where: media: { none: {} } 필터).
function BulkAttachMediaPanel({ onDone }: { onDone: (msg: string) => void }) {
  const [kind, setKind] = useState<"image" | "images" | "video">("image");
  const [pending, startTransition] = useTransition();

  function submit() {
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `미디어가 없는 모든 피드 게시물에 ${
          kind === "image" ? "이미지 1장" : kind === "images" ? "이미지 3장" : "동영상"
        } 을(를) 일괄 주입합니다.\n\n진행할까요?`,
      );
      if (!ok) return;
    }
    startTransition(async () => {
      const r = await bulkAttachFeedMediaAction({ kind });
      if (!r.ok) {
        onDone(`일괄 주입 실패: ${r.message}`);
        return;
      }
      onDone(
        `일괄 주입 완료 — 대상 ${r.scanned}개 게시물, 미디어 ${r.attached_media}건 생성 (${kind}).`,
      );
    });
  }

  return (
    <PanelCard
      title="미디어 일괄 주입"
      description="미디어가 없는 모든 피드 게시물에 placeholder 이미지/동영상을 일괄 주입합니다. 이미 미디어가 있는 게시물은 건드리지 않습니다."
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          {(
            [
              { v: "image", label: "이미지 1장" },
              { v: "images", label: "이미지 3장" },
              { v: "video", label: "동영상 1개" },
            ] as const
          ).map((opt) => (
            <label
              key={opt.v}
              className={
                "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm cursor-pointer transition " +
                (kind === opt.v
                  ? "border-accent bg-accent/5 text-accent font-medium"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
              }
            >
              <input
                type="radio"
                name="bulk-attach-kind"
                value={opt.v}
                checked={kind === opt.v}
                onChange={() => setKind(opt.v)}
                className="accent-indigo-600"
              />
              {opt.label}
            </label>
          ))}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={pending}
          className="rounded-xl bg-accent px-4 py-2 text-sm text-white font-medium hover:opacity-90 disabled:opacity-60"
          data-testid="btn-bulk-attach-media"
        >
          {pending ? "주입 중..." : "모든 게시물에 일괄 주입"}
        </button>
      </div>
    </PanelCard>
  );
}
