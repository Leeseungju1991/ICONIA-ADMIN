"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import { hidePost, unhidePost } from "@/lib/adminApi";

export async function hidePostAction(formData: FormData) {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const postId = String(formData.get("post_id") || "");
  const reason = String(formData.get("reason") || "");
  if (!postId || !reason) return { ok: false, message: "post_id / reason 누락" };
  const res = await hidePost({ jwt, postId, reason });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/posts");
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
  return { ok: true };
}
