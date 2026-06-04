"use server";

// (주)숨코리아 출시 정비 — 피드 관리 server actions.
// SERVER 동시 작업으로 `/api/v1/admin/feed/posts*` 가 추가되는 중. 미배포 상태에서도
// ERR_NETWORK / ERR_SERVER_UNAVAILABLE 이 그대로 message 로 전달되어 UI 가 "준비 중"
// 배지로 graceful 안내.

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import {
  listAdminFeedPosts,
  getAdminFeedPost,
  patchAdminFeedPost,
  deleteAdminFeedPost,
  type AdminFeedPostsList,
  type AdminFeedPostDetail,
  type AdminFeedPostRow,
} from "@/lib/adminApi";

export type FeedListResult =
  | { ok: true; data: AdminFeedPostsList }
  | { ok: false; message: string; code?: string };

export async function listFeedPostsAction(input: {
  q?: string;
  hidden?: "all" | "true" | "false";
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
}): Promise<FeedListResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listAdminFeedPosts({ jwt, ...input });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export type FeedDetailResult =
  | { ok: true; data: AdminFeedPostDetail }
  | { ok: false; message: string; code?: string };

export async function getFeedPostAction(input: { id: string }): Promise<FeedDetailResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await getAdminFeedPost({ jwt, id: input.id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export type FeedMutationResult =
  | { ok: true; post: AdminFeedPostRow }
  | { ok: false; message: string; code?: string };

export async function patchFeedPostAction(input: {
  id: string;
  body?: string;
  is_hidden?: boolean;
  // Server `2. SERVER/src/routes/adminFeedCommerceRoutes.js:48` 정합 — published/hidden/removed.
  status?: "published" | "hidden" | "removed";
  visibility?: "public" | "followers" | "private";
  moderation_note?: string;
}): Promise<FeedMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  // Phase B 정합 — zod 로 server action 입력 검증. 클라이언트 검증과 동일 schema.
  const { patchFeedPostSchema, firstZodError } = await import(
    "@/lib/schemas/adminForms"
  );
  const parsed = patchFeedPostSchema.safeParse({
    body: input.body,
    is_hidden: input.is_hidden,
    status: input.status,
    visibility: input.visibility,
    moderation_note: input.moderation_note,
  });
  if (!parsed.success) {
    return { ok: false, message: firstZodError(parsed.error), code: "ERR_VALIDATION" };
  }
  const res = await patchAdminFeedPost({
    jwt,
    id: input.id,
    body: input.body,
    is_hidden: input.is_hidden,
    status: input.status,
    visibility: input.visibility,
    moderation_note: input.moderation_note,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  revalidatePath("/dashboard/feed");
  return { ok: true, post: res.data };
}

// 2026-06-04 — 운영자 일괄 미디어 주입 (피드).
//   server POST /api/v1/admin/feed/posts/bulk-attach-media { kind } 호출.
//   기존 FeedMedia 가 0건인 게시물에만 placeholder 미디어 주입.
export type BulkAttachFeedMediaResult =
  | { ok: true; scanned: number; attached_posts: number; attached_media: number; kind: string }
  | { ok: false; message: string; code?: string };

export async function bulkAttachFeedMediaAction(input: {
  kind: "image" | "images" | "video";
}): Promise<BulkAttachFeedMediaResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const { authedRequest } = await import("@/lib/httpClient");
  const res = await authedRequest<{
    scanned: number;
    attached_posts: number;
    attached_media: number;
    kind: string;
  }>({
    jwt,
    path: "/api/v1/admin/feed/posts/bulk-attach-media",
    method: "POST",
    body: { kind: input.kind },
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  revalidatePath("/dashboard/feed");
  return { ok: true, ...res.data };
}

export async function deleteFeedPostAction(input: { id: string }): Promise<{ ok: boolean; message?: string; code?: string }> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await deleteAdminFeedPost({ jwt, id: input.id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  revalidatePath("/dashboard/feed");
  return { ok: true };
}
