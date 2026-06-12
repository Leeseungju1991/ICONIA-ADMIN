"use server";

// Phase 15-A — Notices CRUD server actions (CS_OR_ABOVE).

import { readSession } from "@/lib/authCookie";
import {
  listNotices,
  createNotice,
  updateNotice,
  deleteNotice,
  type NoticeI18n,
  type NoticeRow,
} from "@/lib/adminApi";

export type NoticesListResult =
  | { ok: true; items: NoticeRow[] }
  | { ok: false; message: string; code?: string };

export async function listNoticesAction(): Promise<NoticesListResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listNotices({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  // Phase 15-A 가 NoticeRow[] 반환하도록 wire — stub 환경에서는 items 가 빈 배열.
  const items = (res.data.items as unknown as NoticeRow[]) ?? [];
  return { ok: true, items };
}

export type NoticeMutationResult =
  | { ok: true; notice: NoticeRow }
  | { ok: false; message: string; code?: string };

// 빈 i18n 키 제거. 모두 비어있으면 null 반환.
//   서버측 normalizeI18n 과 같은 의도 — 클라이언트에서도 1차 정리해 전송량/오류 가능성을 줄임.
function cleanI18n(v: NoticeI18n | undefined): NoticeI18n | null {
  if (!v) return null;
  const out: NoticeI18n = {};
  // 2026-06-12 — ADMIN 신규 작성은 ko/en 만 (ja/zh 제거).
  for (const k of ["ko", "en"] as const) {
    const s = v[k];
    if (typeof s === "string" && s.trim().length > 0) out[k] = s.trim();
  }
  return Object.keys(out).length === 0 ? null : out;
}

export async function createNoticeAction(args: {
  title: string;
  body: string;
  title_i18n?: NoticeI18n;
  body_i18n?: NoticeI18n;
  audience?: string;
  order_idx?: number;
}): Promise<NoticeMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.title || args.title.trim().length < 2) {
    return { ok: false, message: "제목은 2자 이상." };
  }
  if (!args.body || args.body.trim().length < 5) {
    return { ok: false, message: "본문은 5자 이상." };
  }
  // 2026-06-12 — order_idx 1~20 (UI select). 범위 밖이면 서버 zod 가 422 반환.
  const orderIdx =
    typeof args.order_idx === "number" && Number.isFinite(args.order_idx)
      ? Math.max(1, Math.min(20, Math.floor(args.order_idx)))
      : undefined;
  // 2026-06-09 T03 — i18n. ko 가 있으면 단일 컬럼 fallback 으로도 ko 본문이 사용된다.
  const titleI18n = cleanI18n(args.title_i18n);
  const bodyI18n = cleanI18n(args.body_i18n);
  const finalTitle = (titleI18n?.ko ?? args.title).trim();
  const finalBody = (bodyI18n?.ko ?? args.body).trim();
  const res = await createNotice({
    jwt,
    title: finalTitle,
    body: finalBody,
    title_i18n: titleI18n,
    body_i18n: bodyI18n,
    audience: args.audience,
    ...(orderIdx !== undefined ? { order_idx: orderIdx } : {}),
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, notice: res.data };
}

export async function deleteNoticeAction(args: { id: string }): Promise<{ ok: boolean; message?: string }> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await deleteNotice({ jwt, id: args.id });
  if (!res.ok) return { ok: false, message: res.message };
  return { ok: true };
}
