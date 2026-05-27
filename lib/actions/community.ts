"use server";

import { cookies } from "next/headers";
import {
  fetchCommunityFeed,
  fetchCommunityPost,
  fetchCommunityHealth,
  hideCommunityPost,
  unhideCommunityPost,
  takedownCommunityPost,
} from "../serverApi.community";
import {
  mockFeedList,
  mockFeedPost,
  mockCommunityHealth,
  type FeedListItem,
  type FeedPost,
  type CommunityHealth,
} from "../mockFeed";
import type { ServerResult } from "../types";

const COOKIE = "iconia_admin_jwt";

function jwt(): string | null {
  return cookies().get(COOKIE)?.value ?? null;
}

export type FeedListResult =
  | {
      ok: true;
      source: "server" | "mock";
      items: FeedListItem[];
      next_cursor: string | null;
    }
  | { ok: false; code: string; message: string };

export async function listFeedAction(
  tab: "latest" | "popular" | "reported",
  cursor?: string,
): Promise<FeedListResult> {
  const token = jwt();
  if (!token) return { ok: false, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  const r = await fetchCommunityFeed(token, tab, cursor);
  if (r.ok) {
    return {
      ok: true,
      source: "server",
      items: r.data.items,
      next_cursor: r.data.next_cursor,
    };
  }
  if (r.code === "ERR_NETWORK" || r.code === "ERR_SERVER_UNAVAILABLE") {
    const m = mockFeedList(tab);
    return { ok: true, source: "mock", items: m.items, next_cursor: m.next_cursor };
  }
  return { ok: false, code: r.code, message: r.message };
}

export type PostDetailResult =
  | { ok: true; source: "server" | "mock"; post: FeedPost }
  | { ok: false; code: string; message: string };

export async function getPostDetailAction(postId: string): Promise<PostDetailResult> {
  const token = jwt();
  if (!token) return { ok: false, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  const r = await fetchCommunityPost(token, postId);
  if (r.ok) return { ok: true, source: "server", post: r.data };
  if (r.code === "ERR_NETWORK" || r.code === "ERR_SERVER_UNAVAILABLE") {
    return { ok: true, source: "mock", post: mockFeedPost(postId) };
  }
  return { ok: false, code: r.code, message: r.message };
}

export type CommunityHealthResult =
  | { ok: true; source: "server" | "mock"; health: CommunityHealth }
  | { ok: false; code: string; message: string };

export async function getCommunityHealthAction(): Promise<CommunityHealthResult> {
  const token = jwt();
  if (!token) return { ok: false, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  const r = await fetchCommunityHealth(token);
  if (r.ok) return { ok: true, source: "server", health: r.data };
  if (r.code === "ERR_NETWORK" || r.code === "ERR_SERVER_UNAVAILABLE") {
    return { ok: true, source: "mock", health: mockCommunityHealth() };
  }
  return { ok: false, code: r.code, message: r.message };
}

export async function hidePostAction(
  postId: string,
  reason: string,
): Promise<ServerResult<{ status: string }> | { ok: false; code: string; message: string }> {
  const token = jwt();
  if (!token) return { ok: false, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  if (reason.trim().length < 5) {
    return { ok: false, code: "ERR_REASON_TOO_SHORT", message: "reason_too_short" };
  }
  return hideCommunityPost(token, postId, reason);
}

export async function unhidePostAction(
  postId: string,
): Promise<ServerResult<{ status: string }> | { ok: false; code: string; message: string }> {
  const token = jwt();
  if (!token) return { ok: false, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  return unhideCommunityPost(token, postId);
}

export async function takedownPostAction(
  postId: string,
  reason: string,
): Promise<ServerResult<{ status: string }> | { ok: false; code: string; message: string }> {
  const token = jwt();
  if (!token) return { ok: false, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  if (reason.trim().length < 5) {
    return { ok: false, code: "ERR_REASON_TOO_SHORT", message: "reason_too_short" };
  }
  return takedownCommunityPost(token, postId, reason);
}
