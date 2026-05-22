"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import { hidePost, listPosts, unhidePost, type PostRow } from "@/lib/adminApi";

export type ListReportedPostsResult =
  | { ok: true; items: PostRow[] }
  | { ok: false; message: string };

// /dashboard/reports client component 가 호출. authCookie (next/headers) 를
// 직접 import 하면 client bundle 에 들어가 빌드 실패하므로 server action 으로 우회.
export async function listReportedPostsAction(): Promise<ListReportedPostsResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listPosts({ jwt, filter: "reported", limit: 200 });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  return { ok: true, items: res.data.items };
}

export async function hidePostAction(formData: FormData) {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const postId = String(formData.get("post_id") || "");
  const reason = String(formData.get("reason") || "");
  if (!postId || !reason) return { ok: false, message: "post_id / reason 누락" };
  const res = await hidePost({ jwt, postId, reason });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/posts");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}

export async function unhidePostAction(formData: FormData) {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const postId = String(formData.get("post_id") || "");
  if (!postId) return { ok: false, message: "post_id 누락" };
  const res = await unhidePost({ jwt, postId });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/posts");
  revalidatePath("/dashboard/reports");
  return { ok: true };
}
