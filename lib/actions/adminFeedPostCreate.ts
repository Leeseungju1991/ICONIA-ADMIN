"use server";

// (주)숨코리아 출시 정비 — 운영팀 수동 피드 게시물 작성 server action.
//
// Server `/api/v1/admin/feed/posts` (POST) 호출. 미디어 URL 배열은 사전에
// /api/v1/admin/media/upload (또는 admin route handler 프록시) 가 발급한 URL.

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import {
  createAdminFeedPost,
  type AdminCreatedFeedPost,
  type AdminFeedPostMediaInput,
} from "@/lib/adminApi";

export type CreateAdminFeedPostResult =
  | { ok: true; data: AdminCreatedFeedPost }
  | { ok: false; message: string; code?: string };

export type CreateAdminFeedPostInputClient = {
  authorId: string;
  body: string;
  media?: AdminFeedPostMediaInput[];
  status?: "published" | "draft" | "hidden";
  reason: string;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateInput(input: CreateAdminFeedPostInputClient): string | null {
  if (!input.authorId || !UUID_RE.test(input.authorId)) {
    return "작성자 ID 가 UUID 형식이 아닙니다.";
  }
  if (!input.body || input.body.trim().length === 0) {
    return "본문을 입력하세요.";
  }
  if (input.body.length > 4000) {
    return "본문은 4000자 이하로 입력하세요.";
  }
  if (input.media && input.media.length > 10) {
    return "미디어는 최대 10개까지 첨부할 수 있습니다.";
  }
  if (!input.reason || input.reason.trim().length < 5) {
    return "운영자 사유는 5자 이상 입력하세요.";
  }
  if (input.reason.length > 256) {
    return "사유는 256자 이하로 입력하세요.";
  }
  return null;
}

export async function createAdminFeedPostAction(
  input: CreateAdminFeedPostInputClient,
): Promise<CreateAdminFeedPostResult> {
  const jwt = readSession();
  if (!jwt) {
    return { ok: false, message: "세션이 만료되었습니다. 다시 로그인하세요.", code: "ERR_UNAUTHORIZED" };
  }
  const v = validateInput(input);
  if (v) return { ok: false, message: v, code: "ERR_VALIDATION" };

  const res = await createAdminFeedPost({
    jwt,
    authorId: input.authorId,
    body: input.body,
    media: input.media,
    status: input.status ?? "published",
    reason: input.reason.trim(),
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  revalidatePath("/dashboard/feed");
  return { ok: true, data: res.data };
}
