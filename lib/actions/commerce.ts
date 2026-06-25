"use server";

import { revalidatePath } from "next/cache";
import { readSession } from "@/lib/authCookie";
import { syncProducts, syncCategories, syncOrders } from "@/lib/adminApi";

export async function syncProductsAction() {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await syncProducts({ jwt });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/commerce/products");
  return { ok: true, synced: res.data.synced };
}

export async function syncCategoriesAction() {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await syncCategories({ jwt });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/commerce/products");
  return { ok: true, synced: res.data.synced };
}

export async function syncOrdersAction() {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await syncOrders({ jwt });
  if (!res.ok) return { ok: false, message: `${res.code}: ${res.message}` };
  revalidatePath("/dashboard/commerce/orders");
  return { ok: true, synced: res.data.synced };
}
