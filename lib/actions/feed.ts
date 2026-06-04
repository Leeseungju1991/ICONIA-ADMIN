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
// 2026-06-05 — 사용자 요청: 미디어 없는 글 일괄 삭제 + 동영상 1/3 혼합.
//   kind="mixed" 옵션 추가 — 서버가 videoRatio 를 인식하면 1/3 video + 2/3 image
//   로 처리하고, 미연동 시(ERR_VALIDATION) graceful 안내.
export type BulkAttachFeedMediaResult =
  | { ok: true; scanned: number; attached_posts: number; attached_media: number; kind: string }
  | { ok: false; message: string; code?: string };

export async function bulkAttachFeedMediaAction(input: {
  kind: "image" | "images" | "video" | "mixed";
  /** 2026-06-05 — kind="mixed" 일 때만 의미. 기본 0.33 (전체의 1/3 video). */
  videoRatio?: number;
}): Promise<BulkAttachFeedMediaResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const { authedRequest } = await import("@/lib/httpClient");
  const body: Record<string, unknown> = { kind: input.kind };
  if (input.kind === "mixed") {
    body.videoRatio = typeof input.videoRatio === "number" ? input.videoRatio : 0.33;
  }
  const res = await authedRequest<{
    scanned: number;
    attached_posts: number;
    attached_media: number;
    kind: string;
  }>({
    jwt,
    path: "/api/v1/admin/feed/posts/bulk-attach-media",
    method: "POST",
    body,
  });
  if (!res.ok) {
    // 2026-06-05 — server 가 mixed 미지원 시(ERR_VALIDATION) 안내 메시지 강화.
    if (input.kind === "mixed" && (res.code === "ERR_VALIDATION" || /must be one of/i.test(res.message))) {
      return {
        ok: false,
        message:
          "혼합 모드(1/3 동영상 + 2/3 이미지) 는 SERVER 측 endpoint(videoRatio 인식) 도입 후 활성화됩니다. 임시로 동영상 또는 이미지 단일 옵션을 사용하세요.",
        code: "ERR_NOT_IMPLEMENTED_SERVER",
      };
    }
    return { ok: false, message: res.message, code: res.code };
  }
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

// 2026-06-05 — 사용자 요청: 미디어 없는 글 일괄 삭제 + 동영상 1/3 혼합.
//   server `/api/v1/admin/feed/posts/bulk-delete-empty` 미배포 — 운영 임시로
//   listFeedPostsAction 페이지 스캔 → 빈 게시물 id 수집 → deleteFeedPostAction
//   를 5개씩 chunk Promise.all 순차 실행. audit_log 는 deleteAdminFeedPost
//   엔드포인트(server 측) 책임.
export type BulkDeleteEmptyResult =
  | { ok: true; scanned: number; deleted: number; failed: number; reason: string }
  | { ok: false; message: string; code?: string };

export async function bulkDeleteEmptyFeedPostsAction(input: {
  reason: string;
}): Promise<BulkDeleteEmptyResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const reason = (input.reason ?? "").trim();
  if (reason.length < 5) {
    return { ok: false, message: "사유는 5자 이상이어야 합니다.", code: "ERR_VALIDATION" };
  }

  // 1) 모든 페이지 스캔 (hidden=all, page_size=500) — 미디어 없는 게시물만 필터.
  const emptyIds: string[] = [];
  let scanned = 0;
  const PAGE_SIZE = 500;
  const MAX_PAGES = 50; // 안전상한 25,000건.
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const r = await listAdminFeedPosts({
      jwt,
      hidden: "all",
      page,
      page_size: PAGE_SIZE,
    });
    if (!r.ok) {
      return { ok: false, message: `목록 조회 실패(p${page}): ${r.message}`, code: r.code };
    }
    const items = r.data.items ?? [];
    scanned += items.length;
    for (const p of items) {
      const mediaCount = typeof p.media_count === "number" ? p.media_count : (p.media?.length ?? 0);
      const hasMedia = mediaCount > 0 || (Array.isArray(p.media) && p.media.length > 0);
      if (!hasMedia) emptyIds.push(p.id);
    }
    const total = r.data.total ?? 0;
    if (items.length < PAGE_SIZE) break;
    if (page * PAGE_SIZE >= total) break;
  }

  if (emptyIds.length === 0) {
    return { ok: true, scanned, deleted: 0, failed: 0, reason };
  }

  // 2) 5개씩 chunk 로 deleteAdminFeedPost 순차 실행.
  const CHUNK = 5;
  let deleted = 0;
  let failed = 0;
  for (let i = 0; i < emptyIds.length; i += CHUNK) {
    const slice = emptyIds.slice(i, i + CHUNK);
    const results = await Promise.all(
      slice.map((id) =>
        deleteAdminFeedPost({ jwt, id })
          .then((res) => ({ id, ok: res.ok }))
          .catch(() => ({ id, ok: false as const })),
      ),
    );
    for (const r of results) {
      if (r.ok) deleted += 1;
      else failed += 1;
    }
  }

  revalidatePath("/dashboard/feed");
  return { ok: true, scanned, deleted, failed, reason };
}
