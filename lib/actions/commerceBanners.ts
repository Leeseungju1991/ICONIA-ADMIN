"use server";

// 2026-06-01 — Commerce Banner admin CRUD server actions (CS_OR_ABOVE).
// Server: GET/POST/PUT/DELETE /api/v1/admin/commerce/banners (commerceBannerRoutes.js).
// 미디어 업로드는 별도 `/api/admin/media/upload` route handler (XHR + progress).

import { readSession } from "@/lib/authCookie";
import {
  listCommerceBanners,
  createCommerceBanner,
  updateCommerceBanner,
  deleteCommerceBanner,
  type CommerceBannerRow,
} from "@/lib/adminApi";

export type BannersListResult =
  | { ok: true; items: CommerceBannerRow[] }
  | { ok: false; message: string; code?: string };

export async function listBannersAction(): Promise<BannersListResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listCommerceBanners({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, items: res.data.items ?? [] };
}

export type BannerMutationResult =
  | { ok: true; banner: CommerceBannerRow }
  | { ok: false; message: string; code?: string };

export async function createBannerAction(args: {
  title: string;
  image_url: string;
  link_type?: string;
  link_target?: string | null;
  order_idx?: number;
  is_published?: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
}): Promise<BannerMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const title = (args.title ?? "").trim();
  const image_url = (args.image_url ?? "").trim();
  if (!title) return { ok: false, message: "타이틀 필수." };
  if (!image_url) return { ok: false, message: "이미지 URL 필수." };
  const res = await createCommerceBanner({
    jwt,
    title,
    image_url,
    link_type: args.link_type,
    link_target: args.link_target,
    order_idx: args.order_idx,
    is_published: args.is_published,
    starts_at: args.starts_at,
    ends_at: args.ends_at,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, banner: res.data };
}

export async function updateBannerAction(args: {
  id: string;
  patch: Partial<
    Pick<
      CommerceBannerRow,
      | "title"
      | "image_url"
      | "link_type"
      | "link_target"
      | "order_idx"
      | "is_published"
      | "starts_at"
      | "ends_at"
    >
  >;
}): Promise<BannerMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.id) return { ok: false, message: "id 누락" };
  const res = await updateCommerceBanner({ jwt, id: args.id, patch: args.patch });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, banner: res.data };
}

export async function deleteBannerAction(args: {
  id: string;
}): Promise<{ ok: boolean; message?: string; code?: string }> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.id) return { ok: false, message: "id 누락" };
  const res = await deleteCommerceBanner({ jwt, id: args.id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true };
}
