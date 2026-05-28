"use server";

// 2026-05-28 — content/commerce 페이지에서 호출하는 server actions.
// 기존 commerce.ts 는 Woo 동기화용. 본 파일은 admin 의 상품 직접 CRUD.

import { readSession } from "@/lib/authCookie";
import {
  listAdminCommerceProducts,
  createAdminCommerceProduct,
  deleteAdminCommerceProduct,
  type AdminCommerceProductRow,
  type AdminCommerceProductsList,
  type CreateProductInput,
} from "@/lib/adminApi";

export type ListProductsResult =
  | { ok: true; items: AdminCommerceProductRow[]; total: number; page: number; page_size: number }
  | { ok: false; message: string; code?: string };

export async function listAdminCommerceProductsAction(args?: {
  q?: string;
  page?: number;
  page_size?: number;
}): Promise<ListProductsResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listAdminCommerceProducts({
    jwt,
    q: args?.q,
    page: args?.page,
    page_size: args?.page_size ?? 50,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  const d = res.data as AdminCommerceProductsList;
  return {
    ok: true,
    items: d.items,
    total: d.total,
    page: d.page,
    page_size: d.page_size,
  };
}

export type ProductMutationResult =
  | { ok: true; product: AdminCommerceProductRow }
  | { ok: false; message: string; code?: string };

export async function createAdminCommerceProductAction(
  input: CreateProductInput,
): Promise<ProductMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!input.name || input.name.trim().length < 1) {
    return { ok: false, message: "상품명은 필수입니다." };
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return { ok: false, message: "가격은 0 이상이어야 합니다." };
  }
  const res = await createAdminCommerceProduct({ jwt, input });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, product: res.data };
}

export async function deleteAdminCommerceProductAction(args: {
  id: string;
}): Promise<{ ok: true } | { ok: false; message: string; code?: string }> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await deleteAdminCommerceProduct({ jwt, id: args.id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true };
}
