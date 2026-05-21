"use server";

// Phase 15-A — Notices CRUD server actions (CS_OR_ABOVE).

import { readSession } from "@/lib/authCookie";
import {
  listNotices,
  createNotice,
  updateNotice,
  deleteNotice,
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

export async function createNoticeAction(args: {
  title: string;
  body: string;
  audience?: string;
}): Promise<NoticeMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.title || args.title.trim().length < 2) {
    return { ok: false, message: "제목은 2자 이상." };
  }
  if (!args.body || args.body.trim().length < 5) {
    return { ok: false, message: "본문은 5자 이상." };
  }
  const res = await createNotice({
    jwt,
    title: args.title.trim(),
    body: args.body.trim(),
    audience: args.audience,
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
