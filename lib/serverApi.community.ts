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

export function fetchCommunityFeed(
  jwt: string,
  tab: "latest" | "popular" | "reported",
  cursor?: string,
) {
  const c = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  return req<{ items: FeedListItem[]; next_cursor: string | null }>(
    `/api/v1/admin/community/feed?tab=${tab}${c}`,
    "GET",
    jwt,
  );
}

export function fetchCommunityPost(jwt: string, postId: string) {
  return req<FeedPost>(
    `/api/v1/admin/community/posts/${encodeURIComponent(postId)}`,
    "GET",
    jwt,
  );
}

export function fetchCommunityHealth(jwt: string) {
  return req<CommunityHealth>(`/api/v1/admin/community/health`, "GET", jwt);
}

export function hideCommunityPost(jwt: string, postId: string, reason: string) {
  return req<{ status: string }>(
    `/api/v1/admin/community/posts/${encodeURIComponent(postId)}/hide`,
    "POST",
    jwt,
    { reason },
  );
}

export function unhideCommunityPost(jwt: string, postId: string) {
  return req<{ status: string }>(
    `/api/v1/admin/community/posts/${encodeURIComponent(postId)}/unhide`,
    "POST",
    jwt,
  );
}

export function takedownCommunityPost(jwt: string, postId: string, reason: string) {
  return req<{ status: string }>(
    `/api/v1/admin/community/posts/${encodeURIComponent(postId)}/takedown`,
    "POST",
    jwt,
    { reason },
  );
}

export function hidePostsByAuthor(jwt: string, authorId: string, reason: string) {
  return req<{ affected: number }>(
    `/api/v1/admin/community/users/${encodeURIComponent(authorId)}/hide-all-posts`,
    "POST",
    jwt,
    { reason },
  );
}
