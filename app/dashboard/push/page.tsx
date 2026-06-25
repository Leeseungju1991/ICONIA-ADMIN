"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { ExpandableRow } from "../_components/ExpandableRow";
import { DangerConfirmDialog } from "../_components/DangerConfirmDialog";
import { AdminToast, useAdminToast } from "../_components/AdminToast";
import {
  listCampaignsAction,
  createAndSendCampaignAction,
  type CampaignsListResult,
} from "@/lib/actions/pushActions";
import type { PushCampaignRow } from "@/lib/adminApi";

// 2026-05-28 — "저장 = 즉시 전체 발송". audience 선택 제거.
// 2026-06-02 UX 통합:
// - 행 클릭(펼침 버튼)으로 본문/도달 통계 펼침 (error-tracking 패턴, ExpandableRow 공통화).
// - 강력액션(즉시 전체 발송) DangerConfirmDialog 색상 강조 모달.

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

type Pending = { title: string; body: string; form: HTMLFormElement } | null;

export default function PushPage() {
  const [state, setState] = useState<CampaignsListResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [sending, startSend] = useTransition();
  const { toast, setToast } = useAdminToast();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

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
    formRef.current = form;
    const fd = new FormData(form);
    const title = String(fd.get("title") || "").trim();
    const body = String(fd.get("body") || "").trim();
    // 즉시 전송하지 않고 색상 강조 모달을 띄움.
    setPending({ title, body, form });
  }

  function confirmSend() {
    if (!pending) return;
    const { title, body, form } = pending;
    startSend(async () => {
      const r = await createAndSendCampaignAction({ title, body });
      if (!r.ok) {
        setToast({ message: `발송 실패: ${r.message}`, tone: "error" });
        setPending(null);
        return;
      }
      setToast({
        message: r.campaign.status === "sent"
          ? `전체 발송 완료 (도달 ${r.campaign.delivered_count ?? 0}건)`
          : `발송 처리됨: ${statusLabel(r.campaign.status)}`,
        tone: "success",
      });
      form.reset();
      setPending(null);
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
              title="전체 설치 사용자에게 즉시 푸시 발송 (되돌릴 수 없음)"
              className="rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2 text-sm font-semibold text-white shadow-card disabled:opacity-60"
            >
              {sending ? "발송 중..." : "삭제 (전체 발송)"}
            </button>
          </div>
        </form>
      </PanelCard>

      <PanelCard
        title="푸시 발송 기록"
        description="행을 펼침으로 본문·도달 통계·발송 시각을 확인합니다."
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
            {items.map((c) => {
              const isOpen = expandedId === c.id;
              return (
                <ExpandableRow
                  key={c.id}
                  expanded={isOpen}
                  onToggle={() => setExpandedId(isOpen ? null : c.id)}
                  summary={
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 truncate">{c.title}</span>
                        <span className={statusChip(c.status)}>{statusLabel(c.status)}</span>
                      </div>
                      {c.status === "sent" ? (
                        <div className="mt-1 text-[11px] text-muted">
                          도달 {c.delivered_count ?? 0}건 · {c.sent_at ?? ""}
                        </div>
                      ) : (
                        <div className="mt-1 text-[11px] text-muted">{c.body.slice(0, 60)}</div>
                      )}
                    </div>
                  }
                  detail={
                    <div className="space-y-2">
                      <div>
                        <div className="text-[11px] text-muted mb-1">본문</div>
                        <p className="text-sm text-slate-800 whitespace-pre-wrap">{c.body}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-600">
                        <div>
                          <span className="text-muted">상태: </span>
                          <span className="font-medium">{statusLabel(c.status)}</span>
                        </div>
                        <div>
                          <span className="text-muted">ID: </span>
                          <span className="font-mono text-[10px]">{c.id}</span>
                        </div>
                        <div>
                          <span className="text-muted">도달: </span>
                          <span>{c.delivered_count ?? 0}건</span>
                        </div>
                        <div>
                          <span className="text-muted">발송 시각: </span>
                          <span>{c.sent_at ?? "—"}</span>
                        </div>
                      </div>
                    </div>
                  }
                />
              );
            })}
          </ul>
        )}
      </PanelCard>

      <DangerConfirmDialog
        open={!!pending}
        title="전체 사용자에게 푸시 발송"
        description={pending ? `"${pending.title}" 알림을 전체 설치 사용자에게 즉시 발송합니다.` : ""}
        detail={
          pending ? (
            <span>
              본문: <span className="line-clamp-3">{pending.body}</span>
            </span>
          ) : null
        }
        confirmLabel="삭제"
        busy={sending}
        onConfirm={confirmSend}
        onCancel={() => {
          if (sending) return;
          setPending(null);
        }}
      />

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}
