"use client";
import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { AdminToast, useAdminToast } from "../_components/AdminToast";
import { CommunityHealthChips } from "../_components/CommunityHealthChips";
import {
  listFeedAction,
  getCommunityHealthAction,
  takedownPostAction,
  unhidePostAction,
} from "@/lib/actions/community";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";
import type { FeedListItem, CommunityHealth } from "@/lib/mockFeed";

// 2026-05-28 — "피드 타임라인" 페이지를 신고된 피드 + 삭제 전용으로 단순화.
// 각 카드에 [삭제] 버튼 직접 노출 → 사유 입력 모달(5자) → takedownPostAction.

export default function CommunityPage() {
  const [items, setItems] = useState<FeedListItem[]>([]);
  const [health, setHealth] = useState<CommunityHealth | null>(null);
  const [pending, start] = useTransition();
  const [target, setTarget] = useState<FeedListItem | null>(null);
  const [reason, setReason] = useState("");
  const { toast, setToast } = useAdminToast();

  function reload() {
    start(async () => {
      const [feed, h] = await Promise.all([
        listFeedAction("reported"),
        getCommunityHealthAction(),
      ]);
      if (feed.ok) setItems(feed.items); else setItems([]);
      if (h.ok) setHealth(h.health);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  function openDeleteModal(item: FeedListItem) {
    setTarget(item);
    setReason("");
  }

  function executeDelete() {
    if (!target) return;
    const trimmed = reason.trim();
    if (trimmed.length < 5) return;
    const id = target.id;
    start(async () => {
      await recordOpsAuditWithSilentRetry({
        action: "community.takedown",
        target_label: `게시물 · ${id}`,
        target_id: id,
        reason: trimmed,
        operator: "(현재 운영자 세션)",
        outcome: "queued",
      });
      const r = await takedownPostAction(id, trimmed);
      setTarget(null);
      setReason("");
      setToast(r?.ok === false ? { message: `삭제 실패: ${r.message ?? "알 수 없음"}`, tone: "error" } : { message: `게시물 ${id} 삭제 완료`, tone: "success" });
      reload();
    });
  }

  function executeRestore(item: FeedListItem) {
    const id = item.id;
    // 2026-06-12 audit — 우발 클릭 차단. 복귀는 mutation 이고 audit 기록되므로
    //   confirm 으로 명시 사용자 의도 확인.
    if (typeof window !== "undefined") {
      const ok = window.confirm(
        `게시물 ${id} 을(를) 복귀시키시겠습니까?\n\n감사 로그에 기록됩니다.`,
      );
      if (!ok) return;
    }
    start(async () => {
      await recordOpsAuditWithSilentRetry({
        action: "community.unhide",
        target_label: `게시물 · ${id}`,
        target_id: id,
        reason: "운영자 복귀 처리",
        operator: "(현재 운영자 세션)",
        outcome: "queued",
      });
      const r = await unhidePostAction(id);
      setToast(r?.ok === false ? { message: `복귀 실패: ${r.message ?? "알 수 없음"}`, tone: "error" } : { message: `게시물 ${id} 복귀 완료`, tone: "success" });
      reload();
    });
  }

  return (
    <div className="space-y-4">
      {health ? <CommunityHealthChips health={health} /> : null}

      <PanelCard
        title="신고된 피드"
        description="신고된 게시물을 확인하고 삭제할 수 있습니다."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={pending}
            className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs disabled:opacity-60"
          >
            {pending ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        {pending && items.length === 0 ? (
          <div className="text-sm text-muted">불러오는 중</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted">신고된 게시물이 없습니다.</div>
        ) : (
          <ul className="space-y-2">
            {items.map((it) => (
              <li
                key={it.id}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-800">{it.author_name}</span>
                    <span className="font-mono text-[10px] text-slate-400">{it.author_id}</span>
                    <span className="chip chip-error">신고 {it.report_count}건</span>
                    {it.status === "taken_down" ? (
                      <span className="chip chip-muted">이미 삭제됨</span>
                    ) : it.status === "hidden" ? (
                      <span className="chip chip-warn">숨김</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 line-clamp-2">{it.excerpt}</p>
                  <div className="mt-1 text-[11px] text-muted">
                    좋아요 {it.like_count.toLocaleString()} · 댓글 {it.comment_count.toLocaleString()} · {it.created_at}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {it.status === "visible" ? (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => openDeleteModal(it)}
                      className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs px-3 py-1.5"
                    >
                      삭제
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => executeRestore(it)}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs px-3 py-1.5"
                    >
                      복귀
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      {target ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">게시물 삭제</h3>
            <p className="text-xs text-slate-600 line-clamp-3">
              <span className="font-medium text-slate-800">{target.author_name}</span> · {target.excerpt}
            </p>
            <label className="block text-xs text-slate-700">
              삭제 사유 (5자 이상)
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm"
                placeholder="예: 욕설/혐오 표현, 음란물, 스팸 등"
              />
            </label>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setTarget(null)}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm"
              >
                취소
              </button>
              <button
                type="button"
                disabled={reason.trim().length < 5 || pending}
                onClick={executeDelete}
                className="rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-2 text-sm"
              >
                {pending ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
