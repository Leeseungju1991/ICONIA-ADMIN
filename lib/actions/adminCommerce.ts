"use server";

// 2026-05-28 — content/commerce 페이지에서 호출하는 server actions.
// 기존 commerce.ts 는 Woo 동기화용. 본 파일은 admin 의 상품 직접 CRUD.
//
// Server 응답(projectProduct) 형식과 ADMIN 의 AdminCommerceProductRow 타입이 일부 다름:
//   price          : server=string  → client=number
//   primary_image  : server          → client=image_url
//   stock_quantity : server          → client=stock
//   카테고리         : server=ProductCategoryLink (별도 join) → client=category (string)
// 본 action 이 normalize 해서 일관된 row 를 반환.

import { readSession } from "@/lib/authCookie";
import {
  listAdminCommerceProducts,
  createAdminCommerceProduct,
  deleteAdminCommerceProduct,
  getAdminCommerceProduct,
  type AdminCommerceProductDetailRaw,
  type AdminCommerceProductRow,
  type CreateProductInput,
} from "@/lib/adminApi";

type ServerProductRaw = {
  id: string;
  name: string;
  short_desc?: string | null;
  description?: string | null;
  price?: string | number | null;
  currency?: string;
  stock_status?: string;
  stock_quantity?: number | null;
  primary_image?: string | null;
  status?: string;
  created_at?: string;
  updated_at?: string;
};

function normalizeProduct(p: ServerProductRaw): AdminCommerceProductRow {
  const priceNum =
    typeof p.price === "number"
      ? p.price
      : typeof p.price === "string"
        ? Number(p.price) || 0
        : 0;
  return {
    id: p.id,
    name: p.name,
    description: p.description ?? p.short_desc ?? null,
    price: priceNum,
    currency: p.currency ?? "KRW",
    category: null,
    image_url: p.primary_image ?? null,
    stock: p.stock_quantity ?? 0,
    is_deleted: p.status === "archived",
    stock_status: (p.stock_status as AdminCommerceProductRow["stock_status"]) ?? undefined,
    created_at: p.created_at ?? new Date().toISOString(),
    updated_at: p.updated_at,
  };
}

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
  const d = res.data as { items: ServerProductRaw[]; total?: number; page?: number; page_size?: number };
  const items = (d.items ?? []).map(normalizeProduct);
  return {
    ok: true,
    items,
    total: d.total ?? items.length,
    page: d.page ?? 1,
    page_size: d.page_size ?? items.length,
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

// 2026-06-02 — 상품 상세 페이지(13) 용 단일 상품 조회.
// SERVER 의 정식 단건 endpoint (GET /api/v1/admin/commerce/products/:id) 직접 호출.
// 응답 = 목록 응답의 단일 item 동일 스키마 + `recent_orders_count` 필드.
export type ProductDetailResult =
  | {
      ok: true;
      product: AdminCommerceProductRow;
      /** server 가 산출한 최근 N일 본 상품 포함 주문 수 (없으면 null). */
      recent_orders_count: number | null;
    }
  | { ok: false; message: string; code?: string };

export async function getAdminCommerceProductAction(args: {
  id: string;
}): Promise<ProductDetailResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.id || args.id.trim().length === 0) {
    return { ok: false, message: "상품 id 누락" };
  }
  const res = await getAdminCommerceProduct({ jwt, id: args.id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  const raw = res.data as AdminCommerceProductDetailRaw;
  if (!raw || !raw.id) {
    return { ok: false, message: "상품을 찾을 수 없습니다.", code: "ERR_NOT_FOUND" };
  }
  const recentRaw = raw.recent_orders_count;
  const recent =
    typeof recentRaw === "number" && Number.isFinite(recentRaw) ? recentRaw : null;
  return {
    ok: true,
    product: normalizeProduct(raw),
    recent_orders_count: recent,
  };
}

// 2026-06-04 — 운영자 일괄 이미지 주입 (커머스).
//   server POST /api/v1/admin/commerce/products/bulk-attach-image 호출.
//   primary_image 가 null/빈 문자열인 상품에만 placeholder URL 주입.
export type BulkAttachProductImageResult =
  | { ok: true; scanned: number; updated: number }
  | { ok: false; message: string; code?: string };

export async function bulkAttachProductImageAction(): Promise<BulkAttachProductImageResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const { authedRequest } = await import("@/lib/httpClient");
  const res = await authedRequest<{ scanned: number; updated: number }>({
    jwt,
    path: "/api/v1/admin/commerce/products/bulk-attach-image",
    method: "POST",
    body: {},
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, ...res.data };
}
