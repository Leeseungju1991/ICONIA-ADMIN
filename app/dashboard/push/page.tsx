"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import {
  listCampaignsAction,
  createAndSendCampaignAction,
  type CampaignsListResult,
} from "@/lib/actions/pushActions";
import type { PushCampaignRow } from "@/lib/adminApi";

// 2026-05-28 — "저장 = 즉시 전체 발송". audience 선택 제거.

const statusLabel = (s: string) =>
  s === "sent" ? "발송 완료" : s === "failed" ? "발송 실패" : s === "draft" ? "대기" : s;
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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") || "").trim();
    const body = String(fd.get("body") || "").trim();
    if (
      typeof window !== "undefined" &&
      !window.confirm(
        `푸시 알림 전송\n\n"${title}"\n\n전체 설치 사용자에게 즉시 발송됩니다. 계속하시겠습니까?`,
      )
    ) {
      return;
    }
    startSend(async () => {
      const r = await createAndSendCampaignAction({ title, body });
      if (!r.ok) {
        setToast(`발송 실패: ${r.message}`);
        return;
      }
      setToast(
        r.campaign.status === "sent"
          ? `전체 발송 완료 (도달 ${r.campaign.delivered_count ?? 0}건)`
          : `발송 처리됨: ${statusLabel(r.campaign.status)}`,
      );
      form.reset();
      reload();
    });
  }

  const items: PushCampaignRow[] = state && state.ok ? state.items : [];

  return (
    <div className="space-y-6">
      <PanelCard title="푸시 알림 작성 (저장 = 즉시 전체 발송)">
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            name="title"
            placeholder="알림 제목 (2자 이상)"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            required
          />
          <textarea
            name="body"
            placeholder="알림 본문 (5자 이상)"
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            required
          />
          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={sending}
              className="rounded-xl bg-accent px-4 py-2 text-sm text-white shadow-card disabled:opacity-60"
            >
              {sending ? "발송 중..." : "저장 (즉시 발송)"}
            </button>
          </div>
        </form>
      </PanelCard>

      <PanelCard
        title="푸시 발송 기록"
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
          <div className="text-sm text-muted">발송된 알림이 없습니다.</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted">발송된 알림이 없습니다.</div>
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((c) => (
              <li
                key={c.id}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-slate-800">{c.title}</span>
                  <span className={statusChip(c.status)}>{statusLabel(c.status)}</span>
                </div>
                <div className="text-xs text-muted line-clamp-2 mt-1">{c.body}</div>
                {c.status === "sent" ? (
                  <div className="mt-1 text-[11px] text-muted">
                    도달 {c.delivered_count ?? 0}건 · {c.sent_at ?? ""}
                  </div>
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
