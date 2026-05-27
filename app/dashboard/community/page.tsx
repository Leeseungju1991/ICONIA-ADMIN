"use client";
import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { PanelCard } from "../_components/PanelCard";
import { MockDataBanner } from "../_components/MockDataBanner";
import { CommunityHealthChips } from "../_components/CommunityHealthChips";
import { FeedTimeline } from "../_components/FeedTimeline";
import { PostInspector, type ModerationKey } from "../_components/PostInspector";
import {
  listFeedAction,
  getPostDetailAction,
  getCommunityHealthAction,
  hidePostAction,
  unhidePostAction,
  takedownPostAction,
} from "@/lib/actions/community";
import { hidePostsByUserAction } from "@/lib/actions/user360";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";
import type { FeedListItem, FeedPost, CommunityHealth } from "@/lib/mockFeed";

const ROLE: import("@/lib/operatorRoles").OperatorRole = "superadmin";

type Tab = "latest" | "popular" | "reported";

export default function CommunityPage() {
  const sp = useSearchParams();
  const initialTab = (sp.get("tab") as Tab) ?? "latest";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [items, setItems] = useState<FeedListItem[]>([]);
  const [picked, setPicked] = useState<FeedPost | null>(null);
  const [health, setHealth] = useState<CommunityHealth | null>(null);
  const [source, setSource] = useState<"server" | "mock" | null>(null);
  const [pending, start] = useTransition();
  const [modal, setModal] = useState<ModerationKey | null>(null);
  const [reason, setReason] = useState("");
  const [confirmText, setConfirmText] = useState("");

  function reload(t: Tab) {
    start(async () => {
      const [feed, h] = await Promise.all([listFeedAction(t), getCommunityHealthAction()]);
      if (feed.ok) { setItems(feed.items); setSource(feed.source); } else { setItems([]); }
      if (h.ok) setHealth(h.health);
    });
  }

  useEffect(() => { reload(tab); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);
  function onTab(t: Tab) { setTab(t); reload(t); }

  function onSelect(id: string) {
    start(async () => {
      const r = await getPostDetailAction(id);
      if (r.ok) setPicked(r.post);
    });
  }

  function onAction(k: ModerationKey) {
    if (!picked) return;
    setReason("");
    setConfirmText("");
    setModal(k);
  }

  async function executeModal() {
    if (!picked || !modal) return;
    const r5 = reason.trim().length >= 5;
    if ((modal === "hide" || modal === "takedown" || modal === "hide_all_by_user") && !r5) return;
    if (confirmText !== "EXECUTE") return;
    start(async () => {
      await recordOpsAuditWithSilentRetry({
        action: `community.${modal}`,
        target_label: `게시물 · ${picked.id}`,
        target_id: picked.id,
        reason: reason.trim() || "(사유 없음)",
        operator: "(현재 운영자 세션)",
        outcome: "queued",
      });
      if (modal === "hide") await hidePostAction(picked.id, reason);
      else if (modal === "unhide") await unhidePostAction(picked.id);
      else if (modal === "takedown") await takedownPostAction(picked.id, reason);
      else if (modal === "hide_all_by_user") await hidePostsByUserAction(picked.author_id, reason);
      setModal(null);
      // 새로고침
      const r = await getPostDetailAction(picked.id);
      if (r.ok) setPicked(r.post);
      reload(tab);
    });
  }

  return (
    <div className="space-y-4">
      {health ? <CommunityHealthChips health={health} /> : null}
      {source === "mock" ? <MockDataBanner reason="Server /api/v1/admin/community 미연결 — mock 표시" /> : null}
      <section className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
        <PanelCard title="피드 타임라인" description="탭으로 최신 · 인기 · 신고됨 전환">
          <FeedTimeline items={items} tab={tab} onTab={onTab} selectedId={picked?.id ?? null} onSelect={onSelect} />
        </PanelCard>
        <PostInspector post={picked} role={ROLE} onAction={onAction} />
      </section>

      {modal ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-semibold text-slate-900">모더레이션 — {modal}</h3>
            {modal !== "unhide" ? (
              <label className="block text-xs text-slate-700">사유 (5자 이상)
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" rows={3} />
              </label>
            ) : null}
            <label className="block text-xs text-slate-700">확인 — 정확히 &quot;EXECUTE&quot; 입력
              <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-200 p-2 text-sm" />
            </label>
            <div className="flex gap-2 justify-end">
              <button type="button" onClick={() => setModal(null)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm">취소</button>
              <button type="button" disabled={pending} onClick={executeModal} className="rounded-lg bg-red-600 disabled:opacity-50 text-white px-4 py-2 text-sm">실행</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
