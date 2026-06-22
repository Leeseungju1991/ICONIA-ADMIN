import { loadEnv } from "./env";
import type { ServerEnvelope, ServerResult } from "./types";
import type { FeedListItem, FeedPost, CommunityHealth } from "./mockFeed";

async function req<T>(
  path: string,
  method: "GET" | "POST",
  jwt: string,
  body?: unknown,
): Promise<ServerResult<T>> {
  const env = loadEnv();
  let response: Response;
  try {
    response = await fetch(`${env.ICONIA_SERVER_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${jwt}`,
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      code: "ERR_NETWORK",
      message: "network_error",
      status: 0,
    };
  }
  if (response.status >= 500) {
    return {
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "server_unavailable",
      status: response.status,
    };
  }
  let envelope: ServerEnvelope<T>;
  try {
    envelope = (await response.json()) as ServerEnvelope<T>;
  } catch {
    return {
      ok: false,
      code: "ERR_INVALID_RESPONSE",
      message: "invalid_response",
      status: response.status,
    };
  }
  if (envelope && envelope.ok === true) return { ok: true, data: envelope.data };
  if (envelope && envelope.ok === false && envelope.error) {
    return {
      ok: false,
      code: envelope.error.code,
      message: envelope.error.message,
      status: response.status,
      details: envelope.error.details,
    };
  }
  return {
    ok: false,
    code: "ERR_INVALID_RESPONSE",
    message: "invalid_response",
    status: response.status,
  };
}

// B5 — community feed → 서버 정본 `/api/v1/admin/feed/posts` 매핑.
export function fetchCommunityFeed(
  jwt: string,
  tab: "latest" | "popular" | "reported",
  cursor?: string,
) {
  const c = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  return req<{ items: FeedListItem[]; next_cursor: string | null }>(
    `/api/v1/admin/feed/posts?tab=${tab}${c}`,
    "GET",
    jwt,
  );
}

// B6 — community post 단건 → 서버 정본 `/api/v1/admin/feed/posts/:id`.
export function fetchCommunityPost(jwt: string, postId: string) {
  return req<FeedPost>(
    `/api/v1/admin/feed/posts/${encodeURIComponent(postId)}`,
    "GET",
    jwt,
  );
}

export function fetchCommunityHealth(jwt: string) {
  return req<CommunityHealth>(`/api/v1/admin/community/health`, "GET", jwt);
}

// B8 — hide/unhide 는 서버 정본 `/api/v1/admin/posts/:id/{hide,unhide}` 매핑.
export function hideCommunityPost(jwt: string, postId: string, reason: string) {
  return req<{ status: string }>(
    `/api/v1/admin/posts/${encodeURIComponent(postId)}/hide`,
    "POST",
    jwt,
    { reason },
  );
}

export function unhideCommunityPost(jwt: string, postId: string) {
  return req<{ status: string }>(
    `/api/v1/admin/posts/${encodeURIComponent(postId)}/unhide`,
    "POST",
    jwt,
  );
}

// B8 (takedown) — 서버 정본 미존재. hide 로 매핑.
export function takedownCommunityPost(jwt: string, postId: string, reason: string) {
  return req<{ status: string }>(
    `/api/v1/admin/posts/${encodeURIComponent(postId)}/hide`,
    "POST",
    jwt,
    { reason },
  );
}

// B9 — POST /api/v1/admin/users/:authorId/hide-posts
// 작성자의 모든 feed_posts 일괄 숨김. 응답: { affected: number }.
// 2026-06-22 서버 배선 완료.
export function hidePostsByAuthor(
  jwt: string,
  authorId: string,
  reason: string,
): Promise<ServerResult<{ affected: number }>> {
  return req<{ affected: number }>(
    `/api/v1/admin/users/${encodeURIComponent(authorId)}/hide-posts`,
    "POST",
    jwt,
    { reason },
  );
}
