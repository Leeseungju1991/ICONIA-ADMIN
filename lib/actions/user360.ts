"use server";

import { cookies } from "next/headers";
import { fetchUser360Snapshot, fetchUser360Timeline } from "../serverApi.user360";
import type { User360Snapshot, User360Event } from "../mockUser360";
import { hideCommunityPost, takedownCommunityPost, unhideCommunityPost, hidePostsByAuthor } from "../serverApi.community";

const COOKIE = "iconia_admin_jwt";

function jwt(): string | null {
  return cookies().get(COOKIE)?.value ?? null;
}

export type User360ActionResult =
  | { ok: true; source: "server"; snapshot: User360Snapshot }
  | { ok: false; code: string; message: string };

export async function fetchUser360Action(key: string): Promise<User360ActionResult> {
  const token = jwt();
  if (!token) return { ok: false, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  const r = await fetchUser360Snapshot(token, key);
  if (r.ok) return { ok: true, source: "server", snapshot: r.data };
  return { ok: false, code: r.code, message: r.message };
}

export type User360TimelineResult =
  | { ok: true; source: "server"; events: User360Event[]; next_cursor: string | null }
  | { ok: false; code: string; message: string };

export async function fetchUser360TimelineAction(key: string): Promise<User360TimelineResult> {
  const token = jwt();
  if (!token) return { ok: false, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  const r = await fetchUser360Timeline(token, key);
  if (r.ok) return { ok: true, source: "server", events: r.data.items, next_cursor: r.data.next_cursor };
  return { ok: false, code: r.code, message: r.message };
}

export async function hidePostsByUserAction(authorId: string, reason: string) {
  const token = jwt();
  if (!token) return { ok: false as const, code: "ERR_UNAUTHENTICATED", message: "no_jwt" };
  if (reason.trim().length < 5) return { ok: false as const, code: "ERR_REASON_TOO_SHORT", message: "reason_too_short" };
  return hidePostsByAuthor(token, authorId, reason);
}
