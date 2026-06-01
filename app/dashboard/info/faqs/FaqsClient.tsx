"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { LoadingState, EmptyState } from "../../_components/CardStates";
import {
  listFaqsAction,
  createFaqAction,
  updateFaqAction,
  deleteFaqAction,
  type FaqsListResult,
} from "@/lib/actions/infoFaqs";
import type { InfoFaqRow } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";

// notices/page.tsx 패턴을 따른다 — list + 작성 폼 + 행별 edit/delete.

export default function FaqsClient() {
  const [state, setState] = useState<FaqsListResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [mutating, startMutate] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editCategory, setEditCategory] = useState("general");
  const [toast, setToast] = useState<string | null>(null);

  function reload() {
    startLoad(async () => {
      const r = await listFaqsAction();
      setState(r);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const question = String(fd.get("question") || "").trim();
    const answer = String(fd.get("answer") || "").trim();
    const category = String(fd.get("category") || "general").trim();
    const order_idx = Number(fd.get("order_idx") || 0);
    const form = e.currentTarget;
    startMutate(async () => {
      const r = await createFaqAction({ question, answer, category, order_idx });
      if (!r.ok) {
        setToast(`작성 실패: ${messageForCode(r.code, r.message)}`);
        return;
      }
      setToast(`FAQ 작성됨: ${r.faq.id}`);
      form.reset();
      reload();
    });
  }

  function startEdit(row: InfoFaqRow) {
    setEditingId(row.id);
    setEditQuestion(row.question);
    setEditAnswer(row.answer);
    setEditCategory(row.category ?? "general");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditQuestion("");
    setEditAnswer("");
    setEditCategory("general");
  }

  function saveEdit(id: string) {
    startMutate(async () => {
      const r = await updateFaqAction({
        id,
        patch: {
          question: editQuestion.trim(),
          answer: editAnswer.trim(),
          category: editCategory.trim() || "general",
        },
      });
      if (!r.ok) {
        setToast(`수정 실패: ${messageForCode(r.code, r.message)}`);
        return;
      }
      setToast("FAQ 수정됨");
      cancelEdit();
      reload();
    });
  }

  function handleDelete(id: string) {
    if (typeof window !== "undefined" && !window.confirm("이 FAQ 를 비공개 처리(삭제) 하시겠습니까?")) return;
    startMutate(async () => {
      const r = await deleteFaqAction({ id });
      if (!r.ok) {
        setToast(`삭제 실패: ${messageForCode(r.code, r.message)}`);
        return;
      }
      setToast("FAQ 삭제됨");
      reload();
    });
  }

  const items: InfoFaqRow[] = state && state.ok ? state.items : [];

  return (
    <div className="space-y-6">
      <PanelCard title="FAQ 작성">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <input
              name="category"
              defaultValue="general"
              placeholder="카테고리 (general/billing/devices...)"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <input
              name="order_idx"
              type="number"
              defaultValue={0}
              placeholder="정렬 idx"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            />
            <div />
          </div>
          <input
            name="question"
            placeholder="질문 (2자 이상)"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            required
          />
          <textarea
            name="answer"
            placeholder="답변 (2자 이상)"
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            required
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={mutating}
              className="rounded-xl bg-accent px-4 py-2 text-sm text-white shadow-card disabled:opacity-60"
            >
              {mutating ? "작성 중..." : "작성"}
            </button>
          </div>
        </form>
      </PanelCard>

      <PanelCard
        title="FAQ 목록"
        description={
          state && state.ok ? `총 ${items.length}건 — 비공개 항목 포함` : undefined
        }
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        {!state ? (
          <LoadingState />
        ) : !state.ok ? (
          <EmptyState
            title="조회할 수 없음"
            hint={messageForCode(state.code, state.message)}
          />
        ) : items.length === 0 ? (
          <EmptyState title="등록된 FAQ 가 없습니다." hint="상단 폼으로 작성하세요." />
        ) : (
          <ul className="space-y-2 text-sm">
            {items.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-3"
              >
                {editingId === f.id ? (
                  <div className="space-y-2">
                    <input
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      placeholder="카테고리"
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <input
                      value={editQuestion}
                      onChange={(e) => setEditQuestion(e.target.value)}
                      placeholder="질문"
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <textarea
                      value={editAnswer}
                      onChange={(e) => setEditAnswer(e.target.value)}
                      rows={3}
                      placeholder="답변"
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => saveEdit(f.id)}
                        disabled={mutating}
                        className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs text-white disabled:opacity-60"
                      >
                        저장
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-700"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="chip chip-muted">{f.category}</span>
                        {!f.is_published ? (
                          <span className="chip chip-warn">비공개</span>
                        ) : null}
                        <span className="text-[10px] text-muted">idx {f.order_idx}</span>
                      </div>
                      <div className="font-medium text-slate-800">{f.question}</div>
                      <div className="text-xs text-muted mt-0.5 whitespace-pre-wrap">
                        {f.answer}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => startEdit(f)}
                        className="rounded-lg bg-white border border-slate-300 px-2 py-1 text-xs text-slate-700"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(f.id)}
                        className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                )}
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
