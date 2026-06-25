"use server";

// 2026-06-01 — Info FAQ admin CRUD server actions (CS_OR_ABOVE).
// Server: GET/POST/PUT/DELETE /api/v1/admin/info/faqs (infoRoutes.js).

import { readSession } from "@/lib/authCookie";
import {
  listInfoFaqs,
  createInfoFaq,
  updateInfoFaq,
  deleteInfoFaq,
  type InfoFaqRow,
} from "@/lib/adminApi";

export type FaqsListResult =
  | { ok: true; items: InfoFaqRow[] }
  | { ok: false; message: string; code?: string };

export async function listFaqsAction(): Promise<FaqsListResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listInfoFaqs({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, items: res.data.items ?? [] };
}

export type FaqMutationResult =
  | { ok: true; faq: InfoFaqRow }
  | { ok: false; message: string; code?: string };

export async function createFaqAction(args: {
  category?: string;
  question: string;
  answer: string;
  // 2026-06-13 (사용자 요청 #13) — 영문 질문/답변(선택).
  question_en?: string;
  answer_en?: string;
  order_idx?: number;
  is_published?: boolean;
  locale?: string;
}): Promise<FaqMutationResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const question = (args.question ?? "").trim();
  const answer = (args.answer ?? "").trim();
  if (question.length < 2) return { ok: false, message: "질문은 2자 이상." };
  if (answer.length < 2) return { ok: false, message: "답변은 2자 이상." };
  const res = await createInfoFaq({
    jwt,
    question,
    answer,
    question_en: args.question_en,
    answer_en: args.answer_en,
    category: args.category,
    order_idx: args.order_idx,
    is_published: args.is_published,
    locale: args.locale,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, faq: res.data };
}

export async function updateFaqAction(args: {
  id: string;
  patch: Partial<
    Pick<
      InfoFaqRow,
      "category" | "question" | "answer" | "order_idx" | "is_published" | "locale"
    >
  >;
}): Promise<FaqMutationResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.id) return { ok: false, message: "id 누락" };
  const res = await updateInfoFaq({ jwt, id: args.id, patch: args.patch });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, faq: res.data };
}

export async function deleteFaqAction(args: {
  id: string;
}): Promise<{ ok: boolean; message?: string; code?: string }> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.id) return { ok: false, message: "id 누락" };
  const res = await deleteInfoFaq({ jwt, id: args.id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true };
}
