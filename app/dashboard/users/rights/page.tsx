"use client";

// 사용자 권리 처리 큐 — PIPA 제35조(열람) / 제36조(정정·삭제) / 제37조(이관).
// Server `/api/v1/admin/users/rights` 정본 only. 미응답 시 빈 큐 표시.

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import {
  listRightsRequestsAction,
  transitionRightsAction,
} from "@/lib/actions/rights";
import type {
  RightsRequestKind,
  RightsRequestRow,
  RightsRequestStatus,
} from "@/lib/adminApi";

const KIND_LABEL: Record<RightsRequestKind, string> = {
  access: "열람 청구 (제35조)",
  rectify: "정정 요청 (제36조)",
  delete: "삭제 요청 (제36조)",
  portability: "이관 요청 (제37조)",
};

const STATUS_LABEL: Record<RightsRequestStatus, string> = {
  received: "접수",
  in_review: "검토 중",
  completed: "처리 완료",
  rejected: "거부",
};

const STATUS_CHIP: Record<RightsRequestStatus, string> = {
  received: "chip chip-warn",
  in_review: "chip chip-info",
  completed: "chip chip-success",
  rejected: "chip chip-error",
};

export default function RightsQueuePage() {
  const [kind, setKind] = useState<RightsRequestKind | "all">("all");
  const [status, setStatus] = useState<RightsRequestStatus | "all">("all");
  const [items, setItems] = useState<RightsRequestRow[]>([]);
  const [placeholder, setPlaceholder] = useState(false);
  const [pipaAugmented, setPipaAugmented] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function reload() {
    startLoad(async () => {
      setLoadError(null);
      const r = await listRightsRequestsAction({
        kind: kind === "all" ? undefined : kind,
        status: status === "all" ? undefined : status,
        limit: 100,
      });
      if (!r.ok) {
        setLoadError(r.message);
        setItems([]);
        return;
      }
      setItems(r.data.items);
      setPlaceholder(r.data.placeholder);
      setPipaAugmented(r.data.pipa_augmented);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, status]);

  async function handleTransition(row: RightsRequestRow, next: RightsRequestStatus) {
    if (row.id.startsWith("demo-") || row.id.startsWith("pipa-")) {
      setToast("placeholder 항목은 Server 도입 후 처리 가능합니다.");
      return;
    }
    const reason =
      typeof window !== "undefined"
        ? window.prompt(
            `${KIND_LABEL[row.kind]} 을 "${STATUS_LABEL[next]}" 로 전이합니다. 사유 (감사 로그, 5자 이상):`,
          )
        : null;
    if (!reason || reason.trim().length < 5) return;
    const r = await transitionRightsAction({
      id: row.id,
      next_status: next,
      reason: reason.trim(),
    });
    if (!r.ok) {
      setToast(`전이 실패: ${r.message}`);
      return;
    }
    setToast("전이 완료");
    reload();
  }

  const counts: Record<RightsRequestStatus, number> = {
    received: 0,
    in_review: 0,
    completed: 0,
    rejected: 0,
  };
  for (const i of items) counts[i.status]++;

  return (
    <div className="space-y-6">
      <PanelCard
        title="권리 요청 큐 — 상태별 카운트"
        description="PIPA 제35/36/37조에 따른 사용자 권리 요청 (열람·정정·삭제·이관)."
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {(Object.keys(counts) as RightsRequestStatus[]).map((s) => (
            <div
              key={s}
              className="rounded-2xl border border-white/60 bg-white/55 p-3"
            >
              <div className="text-[11px] text-muted">{STATUS_LABEL[s]}</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">
                {counts[s]}
              </div>
            </div>
          ))}
        </div>
      </PanelCard>

      <PanelCard
        title="권리 요청 목록"
        actions={
          <div className="flex gap-2">
            <select
              className="rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-xs"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="all">전체 종류</option>
              <option value="access">{KIND_LABEL.access}</option>
              <option value="rectify">{KIND_LABEL.rectify}</option>
              <option value="delete">{KIND_LABEL.delete}</option>
              <option value="portability">{KIND_LABEL.portability}</option>
            </select>
            <select
              className="rounded-xl border-2 border-slate-300 bg-white px-3 py-1.5 text-xs"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="all">전체 상태</option>
              <option value="received">{STATUS_LABEL.received}</option>
              <option value="in_review">{STATUS_LABEL.in_review}</option>
              <option value="completed">{STATUS_LABEL.completed}</option>
              <option value="rejected">{STATUS_LABEL.rejected}</option>
            </select>
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-xl bg-white/70 border border-white/70 px-3 py-1.5 text-xs disabled:opacity-60"
            >
              {loading ? "조회 중..." : "새로고침"}
            </button>
          </div>
        }
      >
        {loadError ? (
          <div className="py-8 text-center text-xs text-muted">데이터 없음</div>
        ) : items.length === 0 ? (
          <div className="text-sm text-muted">
            {loading ? "불러오는 중" : "요청이 없습니다."}
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-white/60 bg-white/55 px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="chip chip-muted">{KIND_LABEL[r.kind]}</span>
                    <span className={STATUS_CHIP[r.status]}>
                      {STATUS_LABEL[r.status]}
                    </span>
                    {r.id.startsWith("pipa-") ? (
                      <span className="chip chip-info">PIPA</span>
                    ) : null}
                  </div>
                  <span className="font-mono text-[10px] text-muted">
                    {r.id}
                  </span>
                </div>
                <div className="mt-1 text-xs">
                  <div>
                    사용자 <span className="font-mono">{r.user_id}</span>
                  </div>
                  {r.user_reason ? (
                    <div className="text-muted line-clamp-2">
                      사유 — {r.user_reason}
                    </div>
                  ) : null}
                  {r.operator_note ? (
                    <div className="text-muted">
                      운영 메모 — {r.operator_note}
                    </div>
                  ) : null}
                  <div className="text-[10px] text-muted mt-1">
                    접수 {r.received_at.slice(0, 19).replace("T", " ")}
                    {r.closed_at
                      ? ` · 처리 ${r.closed_at.slice(0, 19).replace("T", " ")}`
                      : ""}
                    {r.operator_id_closed ? ` · ${r.operator_id_closed}` : ""}
                  </div>
                </div>
                {r.status !== "completed" && r.status !== "rejected" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {r.status === "received" ? (
                      <button
                        type="button"
                        onClick={() => handleTransition(r, "in_review")}
                        className="rounded-lg bg-sky-50 border border-sky-200 px-2.5 py-1 text-xs text-sky-700"
                      >
                        검토 시작
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => handleTransition(r, "completed")}
                      className="rounded-lg bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs text-emerald-700"
                    >
                      처리 완료
                    </button>
                    <button
                      type="button"
                      onClick={() => handleTransition(r, "rejected")}
                      className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs text-rose-700"
                    >
                      거부
                    </button>
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
