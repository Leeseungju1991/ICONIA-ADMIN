"use server";

// (주)숨코리아 출시 정비 — 커머스 (상품 / 주문) 관리 server actions.
// SERVER 신규 endpoint `/api/v1/admin/commerce/{products,orders}*`. 미배포 시
// graceful (UI 는 "준비 중" 안내 + 빈 테이블).

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import {
  listAdminCommerceProducts,
  createAdminCommerceProduct,
  updateAdminCommerceProduct,
  deleteAdminCommerceProduct,
  listAdminCommerceOrders,
  getAdminCommerceOrder,
  updateAdminCommerceOrderStatus,
  type AdminCommerceProductsList,
  type AdminCommerceProductRow,
  type AdminCommerceOrdersList,
  type AdminCommerceOrderDetail,
  type AdminCommerceOrderRow,
  type AdminCommerceOrderStatus,
  type CreateProductInput,
} from "@/lib/adminApi";

// ---- Products ----

export type ProductsListResult =
  | { ok: true; data: AdminCommerceProductsList }
  | { ok: false; message: string; code?: string };

export async function listAdminProductsAction(input: {
  q?: string;
  category?: string;
  only_zero_stock?: boolean;
  page?: number;
  page_size?: number;
}): Promise<ProductsListResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listAdminCommerceProducts({ jwt, ...input });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export type ProductMutationResult =
  | { ok: true; product: AdminCommerceProductRow }
  | { ok: false; message: string; code?: string };

export async function createAdminProductAction(
  input: CreateProductInput,
): Promise<ProductMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!input.name || input.name.trim().length < 2) {
    return { ok: false, message: "상품명은 2자 이상." };
  }
  if (!Number.isFinite(input.price) || input.price < 0) {
    return { ok: false, message: "가격은 0 이상." };
  }
  if (!Number.isFinite(input.stock) || input.stock < 0) {
    return { ok: false, message: "재고는 0 이상." };
  }
  const res = await createAdminCommerceProduct({ jwt, input });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  revalidatePath("/dashboard/commerce/products");
  return { ok: true, product: res.data };
}

export async function updateAdminProductAction(input: {
  id: string;
  patch: Partial<CreateProductInput>;
}): Promise<ProductMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await updateAdminCommerceProduct({ jwt, id: input.id, patch: input.patch });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  revalidatePath("/dashboard/commerce/products");
  return { ok: true, product: res.data };
}

export async function deleteAdminProductAction(input: { id: string }): Promise<{ ok: boolean; message?: string }> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await deleteAdminCommerceProduct({ jwt, id: input.id });
  if (!res.ok) return { ok: false, message: res.message };
  revalidatePath("/dashboard/commerce/products");
  return { ok: true };
}

// ---- Orders ----

export type OrdersListResult =
  | { ok: true; data: AdminCommerceOrdersList }
  | { ok: false; message: string; code?: string };

export async function listAdminOrdersAction(input: {
  status?: AdminCommerceOrderStatus | "all";
  page?: number;
  page_size?: number;
}): Promise<OrdersListResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listAdminCommerceOrders({ jwt, ...input });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export type OrderDetailResult =
  | { ok: true; data: AdminCommerceOrderDetail }
  | { ok: false; message: string; code?: string };

export async function getAdminOrderAction(input: { id: string }): Promise<OrderDetailResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await getAdminCommerceOrder({ jwt, id: input.id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export type OrderStatusResult =
  | { ok: true; order: AdminCommerceOrderRow }
  | { ok: false; message: string; code?: string };

export async function updateAdminOrderStatusAction(input: {
  id: string;
  status: AdminCommerceOrderStatus;
  reason?: string;
}): Promise<OrderStatusResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await updateAdminCommerceOrderStatus({
    jwt,
    id: input.id,
    status: input.status,
    reason: input.reason,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  revalidatePath("/dashboard/commerce/orders");
  return { ok: true, order: res.data };
}
