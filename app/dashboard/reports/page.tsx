"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { OpsAuditTrailPanel } from "../_components/OpsAuditTrailPanel";
import { MockDataBanner } from "../_components/MockDataBanner";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";
import type { PostRow } from "@/lib/adminApi";
import {
  listReportedPostsAction,
  hidePostAction,
  unhidePostAction,
} from "@/lib/actions/posts";

// Phase 14-B — reports 재설계.
// Server `GET /api/v1/admin/posts?filter=reported` (Phase 1 adminStubRoutes) 단일 source.
// 응답: { items: PostRow[], next_cursor }
//
// 이전: mockReports 가 review/post/comment/user 4 유형 통합. Server 는 posts 만 매핑.
// 재설계: posts 신고만 표시 + review/comment/user 는 endpoint 부재 명시 (별도 라운드).
//
// 2026-05-22 — client → server-only(next/headers) import 가 빌드를 깨뜨려
// listReportedPostsAction / hidePostAction / unhidePostAction 의 server action 경로로 일원화.

const statusChip: Record<string, string> = {
  visible: "chip chip-warn",
  hidden: "chip chip-error",
  taken_down: "chip chip-error",
};
const statusLabel: Record<string, string> = {
  visible: "검토 대기",
  hidden: "숨김 처리됨",
  taken_down: "영구 차단",
};

async function runHide(postId: string, reason: string) {
  const fd = new FormData();
  fd.append("post_id", postId);
  fd.append("reason", reason);
  return hidePostAction(fd);
}

async function runUnhide(postId: string) {
  const fd = new FormData();
  fd.append("post_id", postId);
  return unhidePostAction(fd);
}

export default function ReportsPage() {
  const [tab, setTab] = useState<"all" | "visible" | "hidden">("visible");
  const [picked, setPicked] = useState<PostRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listReportedPostsAction();
      if (!r.ok) {
        setError(r.message);
        setPosts([]);
      } else {
        setError(null);
        setPosts(r.items);
      }
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return posts.filter((p) => {
      if (tab === "all") return true;
      if (tab === "visible") return p.status === "visible";
      if (tab === "hidden") return p.status === "hidden" || p.status === "taken_down";
      return true;
    });
  }, [posts, tab]);

  const summary = useMemo(() => {
    const pending = posts.filter((p) => p.status === "visible").length;
    const hidden = posts.filter(
      (p) => p.status === "hidden" || p.status === "taken_down",
    ).length;
    const highVolume = posts.filter(
      (p) => p.status === "visible" && p.reported_count >= 5,
    ).length;
    return { pending, hidden, highVolume, total: posts.length };
  }, [posts]);

  async function handleHide(p: PostRow) {
    if (typeof window !== "undefined") {
      const phrase = window.prompt(
        `게시물 숨김 처리\n\n강력 액션입니다. 실행하려면 정확히 "EXECUTE" 를 입력하세요.`,
      );
      if (phrase !== "EXECUTE") {
        setToast("실행 취소 — 확인 문구 불일치.");
        return;
      }
    }
    const reason = window.prompt("숨김 사유 (감사 로그에 기록, 5자 이상):");
    if (!reason || reason.trim().length < 5) {
      setToast("사유가 5자 이상 필요합니다.");
      return;
    }
    const r = await runHide(p.post_id, reason.trim());
    if (!r.ok) {
      setToast(`숨김 처리 실패: ${r.message}`);
      return;
    }
    await recordOpsAuditWithSilentRetry({
      action: "report.hide_post",
      target_label: `게시물 · ${p.post_id}`,
      target_id: p.post_id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "succeeded",
    });
    setAuditTick((t) => t + 1);
    setPicked(null);
    setToast(`게시물 ${p.post_id} 숨김 처리 완료.`);
    reload();
  }

  async function handleUnhide(p: PostRow) {
    const r = await runUnhide(p.post_id);
    if (!r.ok) {
      setToast(`복구 실패: ${r.message}`);
      return;
    }
    await recordOpsAuditWithSilentRetry({
      action: "report.unhide_post",
      target_label: `게시물 · ${p.post_id}`,
      target_id: p.post_id,
      reason: "운영자 검토 후 복구",
      operator: "(현재 운영자 세션)",
      outcome: "succeeded",
    });
    setAuditTick((t) => t + 1);
    setPicked(null);
    setToast(`게시물 ${p.post_id} 복구 완료.`);
    reload();
  }

  type Row = PostRow & { id: string };
  const columns: Column<Row>[] = [
    { key: "post", header: "게시물 ID", render: (r) => <span className="font-mono text-xs">{r.post_id}</span> },
    { key: "author", header: "작성자", render: (r) => <span className="font-mono text-xs">{r.author_handle ?? r.author_user_id}</span> },
    { key: "body", header: "내용 발췌", render: (r) => <span className="text-slate-700 line-clamp-1 max-w-[300px] inline-block align-middle">{r.body_excerpt}</span> },
    { key: "reports", header: "신고 수", align: "right", render: (r) => r.reported_count },
    { key: "reactions", header: "반응", align: "right", render: (r) => `${r.reaction_count}/${r.comment_count}` },
    { key: "status", header: "상태", render: (r) => <span className={statusChip[r.status] ?? "chip chip-muted"}>{statusLabel[r.status] ?? r.status}</span> },
    { key: "date", header: "작성일", render: (r) => <span className="text-xs text-muted">{r.created_at}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button className="btn-outline text-xs" type="button" onClick={() => setPicked(r)}>
          처리
        </button>
      ),
    },
  ];

  const tabs: Array<{ key: "visible" | "hidden" | "all"; label: string; count: number }> = [
    { key: "visible", label: "검토 대기", count: summary.pending },
    { key: "hidden", label: "숨김 처리됨", count: summary.hidden },
    { key: "all", label: "전체", count: summary.total },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="검토 대기 (visible)"
          value={String(summary.pending)}
          delta={summary.pending > 0 ? "처리 필요" : "없음"}
          deltaTone={summary.pending > 0 ? "down" : "up"}
          hint="신고 들어온 visible 게시물"
          accent="orange"
        />
        <StatCard
          label="다발 신고 (5회+)"
          value={String(summary.highVolume)}
          hint="우선 검토 권장"
          accent="pink"
        />
        <StatCard label="숨김 처리됨" value={String(summary.hidden)} hint="누적" accent="blue" />
        <StatCard label="전체 신고 게시물" value={String(summary.total)} hint="Server 정본" accent="teal" />
      </section>

      <MockDataBanner
        reason="현재는 게시물(FeedPost) 신고만 표시. 리뷰·댓글·사용자 신고 endpoint 는 별도 라운드."
        endpoint="/api/v1/admin/reports/{reviews,comments,users} (TBD)"
      />

      <PanelCard
        title="신고 처리 — 게시물 (Server 정본)"
        description="Server /api/v1/admin/posts?filter=reported — FeedReport 가 걸린 FeedPost 만. 숨김·복구는 Server mutation 으로 적용."
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
        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mb-3">
            Server 도달 실패: {error}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "rounded-full px-3.5 py-1.5 text-xs font-medium border transition",
                tab === t.key
                  ? "bg-white/85 border-white/80 text-slate-900 shadow-card"
                  : "bg-white/40 border-white/50 text-slate-600 hover:bg-white/60",
              ].join(" ")}
            >
              {t.label} <span className="text-muted ml-1">{t.count}</span>
            </button>
          ))}
        </div>
        <DataTable
          columns={columns}
          rows={filtered.map((p) => ({ ...p, id: p.post_id }))}
          rowKey={(r) => r.post_id}
          empty="해당 조건의 신고 게시물이 없습니다."
        />
      </PanelCard>

      <OpsAuditTrailPanel
        prefix="report."
        title="신고 처리 운영자 액션 audit (세션)"
        description="콘텐츠 숨김·복구 등 운영자 조치 기록. Server audit_log 와 자동 머지 — adminStub posts 라우트가 audit_log 자동 기록."
        refresh={{ tick: auditTick }}
      />

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card max-w-md">
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">
            닫기
          </button>
        </div>
      ) : null}

      {picked ? (
        <ReportDrawer
          post={picked}
          onClose={() => setPicked(null)}
          onHide={() => handleHide(picked)}
          onUnhide={() => handleUnhide(picked)}
        />
      ) : null}
    </div>
  );
}

function ReportDrawer({
  post,
  onClose,
  onHide,
  onUnhide,
}: {
  post: PostRow;
  onClose: () => void;
  onHide: () => void;
  onUnhide: () => void;
}) {
  const isHidden = post.status === "hidden" || post.status === "taken_down";
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
        <h3 className="text-lg font-bold text-slate-900">신고 게시물 상세</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{post.post_id}</p>

        <dl className="mt-5 space-y-3 text-sm">
          <RowBlock label="작성자" value={<span className="font-mono">{post.author_handle ?? post.author_user_id}</span>} />
          <RowBlock label="신고 수" value={`${post.reported_count}회`} />
          <RowBlock label="반응/댓글" value={`👍 ${post.reaction_count} · 💬 ${post.comment_count}`} />
          <RowBlock label="상태" value={<span className={statusChip[post.status] ?? "chip chip-muted"}>{statusLabel[post.status] ?? post.status}</span>} />
          <RowBlock label="작성일" value={post.created_at} />
          <div className="rounded-xl bg-white/60 border border-white/60 p-3">
            <div className="text-xs text-muted mb-1">내용 발췌</div>
            <p className="text-sm text-slate-800">{post.body_excerpt}</p>
          </div>
        </dl>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {isHidden ? (
            <button className="btn-primary text-sm col-span-2" type="button" onClick={onUnhide}>
              복구 (unhide)
            </button>
          ) : (
            <button className="btn-danger text-sm col-span-2" type="button" onClick={onHide}>
              숨김 처리 (hide)
            </button>
          )}
        </div>
        <p className="text-[11px] text-muted mt-3">
          ※ 숨김은 EXECUTE 2단계 확인 + 5자 사유 prompt 필수. 모든 조치는 Server audit_log + 세션
          audit trail 양쪽에 기록됩니다.
        </p>
      </div>
    </div>
  );
}

function RowBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-slate-800 font-medium">{value}</span>
    </div>
  );
}
