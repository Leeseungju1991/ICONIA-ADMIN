"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { LoadingState, EmptyState } from "../../_components/CardStates";
import { DangerConfirmDialog } from "../../_components/DangerConfirmDialog";
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

// 2026-06-11 — 사용자 요청: 카테고리를 영문 자유입력에서 한글 하위카테고리 select 로 전환.
//   DB 컬럼은 varchar(64) 그대로 — 값은 "parent.child" dot-notation 으로 저장한다.
//   legacy 값 ("general" 등) 은 fallback 으로 raw 그대로 표시.
const FAQ_CATEGORIES: Array<{
  key: string;
  label: string;
  children: Array<{ key: string; label: string }>;
}> = [
  {
    key: "general",
    label: "일반",
    children: [
      { key: "general.service", label: "서비스 안내" },
      { key: "general.signup", label: "가입/로그인" },
    ],
  },
  {
    key: "account",
    label: "계정",
    children: [
      { key: "account.profile", label: "회원정보" },
      { key: "account.withdrawal", label: "회원탈퇴" },
      { key: "account.notification", label: "알림설정" },
    ],
  },
  {
    key: "billing",
    label: "결제",
    children: [
      { key: "billing.subscription", label: "구독" },
      { key: "billing.payment", label: "결제수단" },
      { key: "billing.refund", label: "환불" },
    ],
  },
  {
    key: "devices",
    label: "기기",
    children: [
      { key: "devices.connection", label: "인형 연결" },
      { key: "devices.firmware", label: "펌웨어" },
      { key: "devices.battery", label: "충전/배터리" },
    ],
  },
  {
    key: "ai",
    label: "AI 대화",
    children: [
      { key: "ai.persona", label: "페르소나" },
      { key: "ai.history", label: "대화 기록" },
      { key: "ai.media", label: "음성/이미지" },
    ],
  },
  {
    key: "safety",
    label: "안전",
    children: [
      { key: "safety.children", label: "어린이 안전" },
      { key: "safety.privacy", label: "개인정보" },
    ],
  },
];

const CATEGORY_KEY_SET = new Set<string>(
  FAQ_CATEGORIES.flatMap((p) => p.children.map((c) => c.key)),
);

const CATEGORY_LABEL_MAP: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const parent of FAQ_CATEGORIES) {
    m[parent.key] = parent.label;
    for (const child of parent.children) {
      m[child.key] = `${parent.label} > ${child.label}`;
    }
  }
  return m;
})();

function formatCategoryLabel(raw: string | null | undefined): string {
  if (!raw) return "—";
  return CATEGORY_LABEL_MAP[raw] ?? raw;
}

const DEFAULT_CATEGORY = "general.service";

// 2026-06-12 — 표시 순서 select 옵션. 작을수록 위 (1=top, 20=bottom).
//   기존 0 기본값(legacy)은 새 폼에서는 1로 출발하지만, DB column 은 그대로 0/1~20 공존.
const ORDER_IDX_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

function CategorySelect({
  name,
  value,
  defaultValue,
  onChange,
  className,
}: {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (next: string) => void;
  className?: string;
}) {
  return (
    <select
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      className={
        className ??
        "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
      }
    >
      {FAQ_CATEGORIES.map((parent) => (
        <optgroup key={parent.key} label={parent.label}>
          {parent.children.map((child) => (
            <option key={child.key} value={child.key}>
              {child.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

export default function FaqsClient() {
  const [state, setState] = useState<FaqsListResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [mutating, startMutate] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editQuestion, setEditQuestion] = useState("");
  const [editAnswer, setEditAnswer] = useState("");
  const [editCategory, setEditCategory] = useState<string>(DEFAULT_CATEGORY);
  const [toast, setToast] = useState<string | null>(null);
  // V1.0 라운드 — window.confirm → DangerConfirmDialog 정합.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

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
    // 2026-06-13 (사용자 요청 #13) — 영문 질문/답변(선택). 입력 시 앱이 영어로 표시.
    const question_en = String(fd.get("question_en") || "").trim();
    const answer_en = String(fd.get("answer_en") || "").trim();
    const category = String(fd.get("category") || DEFAULT_CATEGORY).trim();
    // 2026-06-12 — select 1~20. 비정상 값(빈 문자열 등)은 1 로 폴백.
    const orderIdxRaw = Number(fd.get("order_idx"));
    const order_idx = Number.isFinite(orderIdxRaw) && orderIdxRaw >= 1 && orderIdxRaw <= 20
      ? orderIdxRaw
      : 1;
    const form = e.currentTarget;
    startMutate(async () => {
      const r = await createFaqAction({ question, answer, question_en, answer_en, category, order_idx });
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
    // legacy 값 (예: 단순 "general") 은 새 taxonomy 와 매칭되지 않으면 default 로 폴백.
    const raw = row.category ?? DEFAULT_CATEGORY;
    setEditCategory(CATEGORY_KEY_SET.has(raw) ? raw : DEFAULT_CATEGORY);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditQuestion("");
    setEditAnswer("");
    setEditCategory(DEFAULT_CATEGORY);
  }

  function saveEdit(id: string) {
    startMutate(async () => {
      const r = await updateFaqAction({
        id,
        patch: {
          question: editQuestion.trim(),
          answer: editAnswer.trim(),
          category: editCategory.trim() || DEFAULT_CATEGORY,
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
    // 강력액션 정합 — 모달 트리거. 실제 삭제는 confirmDelete.
    setPendingDeleteId(id);
  }

  function confirmDelete() {
    const id = pendingDeleteId;
    if (!id) return;
    setPendingDeleteId(null);
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
            <CategorySelect name="category" defaultValue={DEFAULT_CATEGORY} />
            {/* 2026-06-12 — 표시 순서 select (1=top, 20=bottom). APP/어드민 둘 다 ASC 정렬. */}
            <select
              name="order_idx"
              defaultValue="1"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              {ORDER_IDX_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {`${n}번 — ${n === 1 ? "맨 위" : n === 20 ? "맨 아래" : "위에서 " + n + "번째"}`}
                </option>
              ))}
            </select>
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
          {/* 2026-06-13 (사용자 요청 #13) — 영문 질문/답변(선택). 입력 시 앱 언어설정이 영어면 영어로 표시. */}
          <input
            name="question_en"
            placeholder="Question (English, optional)"
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <textarea
            name="answer_en"
            placeholder="Answer (English, optional)"
            rows={3}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
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
                    <CategorySelect
                      value={editCategory}
                      onChange={setEditCategory}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
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
                        <span className="chip chip-muted">{formatCategoryLabel(f.category)}</span>
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

      <DangerConfirmDialog
        open={pendingDeleteId !== null}
        title="FAQ 삭제"
        description="FAQ 를 비공개(삭제) 처리합니다. 사용자 화면에서 즉시 사라집니다."
        detail={
          pendingDeleteId ? (
            <span>대상 id: <code className="font-mono">{pendingDeleteId}</code></span>
          ) : null
        }
        confirmLabel="삭제"
        busy={mutating}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
