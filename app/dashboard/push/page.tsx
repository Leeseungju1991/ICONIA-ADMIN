"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import {
  listCampaignsAction,
  createCampaignAction,
  sendCampaignAction,
  type CampaignsListResult,
  type CampaignMutationResult,
} from "@/lib/actions/pushActions";
import type { PushCampaignRow } from "@/lib/adminApi";

// Phase 15 — push campaigns CRUD wiring.
// Server `/admin/push/campaigns` (PushCampaign prisma model + migration 20260521100000).
// 발송은 expoPushService 호출.

const AUDIENCES = ["all", "owner", "operator", "beta"] as const;
const statusChip = (s: string) =>
  s === "sent"
    ? "chip chip-success"
    : s === "failed"
      ? "chip chip-error"
      : s === "draft"
        ? "chip chip-warn"
        : "chip chip-muted";

export default function PushPage() {
  const [state, setState] = useState<CampaignsListResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [creating, startCreate] = useTransition();
  const [sending, startSend] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function reload() {
    startLoad(async () => {
      const r = await listCampaignsAction();
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
      const r: CampaignMutationResult = await createCampaignAction({ title, body, audience });
      if (!r.ok) {
        setToast(`저장 실패: ${r.message}`);
        return;
      }
      setToast(`캠페인 저장됨: ${r.campaign.id}`);
      e.currentTarget?.reset?.();
      reload();
    });
  }

  function handleSend(id: string, title: string) {
    if (
      typeof window === "undefined" ||
      !window.confirm(
        `푸시 캠페인 발송\n\n"${title}"\n\n⚠ 실제 사용자에게 발송됩니다. 대상 audience 확인했습니까?`,
      )
    ) {
      return;
    }
    startSend(async () => {
      const r = await sendCampaignAction({ id });
      if (!r.ok) {
        setToast(`발송 실패: ${r.message}`);
        return;
      }
      setToast(`발송됨: ${r.campaign.id} (status=${r.campaign.status})`);
      reload();
    });
  }

  const items: PushCampaignRow[] = state && state.ok ? state.items : [];

  return (
    <div className="space-y-6">
      <PanelCard title="캠페인 내용 작성">
        <form onSubmit={handleCreate} className="space-y-3">
          <input
            name="title"
            placeholder="알림 제목 (2자 이상)"
            className="w-full rounded-xl border-2 border-slate-500 bg-white px-3 py-2 text-sm focus:border-slate-700 focus:outline-none"
            required
          />
          <textarea
            name="body"
            placeholder="알림 본문 (5자 이상)"
            rows={3}
            className="w-full rounded-xl border-2 border-slate-500 bg-white px-3 py-2 text-sm focus:border-slate-700 focus:outline-none"
            required
          />
          <div className="flex items-center gap-2">
            <select
              name="audience"
              defaultValue="all"
              className="rounded-xl border-2 border-slate-500 bg-white px-3 py-2 text-sm"
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
              {creating ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </PanelCard>

      <PanelCard
        title="푸시 캠페인 발송 기록"
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
          <div className="text-sm text-muted">발송된 캠페인이 없습니다.</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted">발송된 캠페인이 없습니다.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-slate-800">{c.title}</span>
                    <span className={statusChip(c.status)}>{c.status}</span>
                    <span className="chip chip-muted">{c.audience}</span>
                  </div>
                  <div className="text-xs text-muted line-clamp-2 mt-1">{c.body}</div>
                  {c.status === "sent" ? (
                    <div className="mt-1 text-[11px] text-muted">
                      도달 {c.delivered_count ?? 0} · 오픈 {c.opened_count ?? 0} · {c.sent_at ?? ""}
                    </div>
                  ) : null}
                </div>
                {c.status === "draft" ? (
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => handleSend(c.id, c.title)}
                    className="rounded-lg bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60 shrink-0"
                  >
                    {sending ? "발송 중..." : "발송"}
                  </button>
                ) : null}
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
