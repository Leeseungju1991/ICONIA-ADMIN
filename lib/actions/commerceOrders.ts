"use server";

// 2026-06-01 — Commerce Orders display-only server actions (CLAUDE.md §2).
// 결제·환불·주문 액션 mutation 절대 추가 금지 — 단순 list + detail 조회만.
// Server: GET /api/v1/admin/commerce/orders/list, GET /api/v1/admin/commerce/orders/:id

import { readSession } from "@/lib/authCookie";
import {
  listCommerceOrders,
  getCommerceOrderDetail,
  type CommerceOrderListItem,
  type CommerceOrderDetail,
} from "@/lib/adminApi";

export type OrdersListResult =
  | { ok: true; items: CommerceOrderListItem[]; total: number }
  | { ok: false; message: string; code?: string };

export async function listOrdersAction(args?: {
  status?: string;
  limit?: number;
}): Promise<OrdersListResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listCommerceOrders({
    jwt,
    status: args?.status,
    limit: args?.limit ?? 50,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, items: res.data.items ?? [], total: res.data.total ?? 0 };
}

export type OrderDetailResult =
  | { ok: true; order: CommerceOrderDetail }
  | { ok: false; message: string; code?: string };

export async function getOrderDetailAction(args: {
  id: string;
}): Promise<OrderDetailResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.id) return { ok: false, message: "id 누락" };
  const res = await getCommerceOrderDetail({ jwt, id: args.id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, order: res.data.order };
}
