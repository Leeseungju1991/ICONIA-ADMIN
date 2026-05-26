import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({
  listAdminCommerceProducts: vi.fn(),
  createAdminCommerceProduct: vi.fn(),
  updateAdminCommerceProduct: vi.fn(),
  deleteAdminCommerceProduct: vi.fn(),
  listAdminCommerceOrders: vi.fn(),
  getAdminCommerceOrder: vi.fn(),
  updateAdminCommerceOrderStatus: vi.fn(),
}));

import {
  listAdminCommerceProducts,
  createAdminCommerceProduct,
  updateAdminCommerceProduct,
  deleteAdminCommerceProduct,
  listAdminCommerceOrders,
  getAdminCommerceOrder,
  updateAdminCommerceOrderStatus,
} from "@/lib/adminApi";
import { revalidatePath } from "next/cache";
import {
  listAdminProductsAction,
  createAdminProductAction,
  updateAdminProductAction,
  deleteAdminProductAction,
  listAdminOrdersAction,
  getAdminOrderAction,
  updateAdminOrderStatusAction,
} from "./commerceAdmin";

const m = {
  listP: listAdminCommerceProducts as unknown as ReturnType<typeof vi.fn>,
  createP: createAdminCommerceProduct as unknown as ReturnType<typeof vi.fn>,
  updateP: updateAdminCommerceProduct as unknown as ReturnType<typeof vi.fn>,
  deleteP: deleteAdminCommerceProduct as unknown as ReturnType<typeof vi.fn>,
  listO: listAdminCommerceOrders as unknown as ReturnType<typeof vi.fn>,
  getO: getAdminCommerceOrder as unknown as ReturnType<typeof vi.fn>,
  updateO: updateAdminCommerceOrderStatus as unknown as ReturnType<typeof vi.fn>,
  revalidate: revalidatePath as unknown as ReturnType<typeof vi.fn>,
};

beforeEach(() => {
  cookieStore.get.mockReset();
  Object.values(m).forEach((fn) => fn.mockReset());
});

describe("commerceAdmin products — auth + validation", () => {
  it("createAdminProductAction rejects empty name", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await createAdminProductAction({
      name: "",
      price: 1000,
      stock: 1,
    });
    expect(r.ok).toBe(false);
    expect(m.createP).not.toHaveBeenCalled();
  });

  it("createAdminProductAction rejects negative price", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await createAdminProductAction({
      name: "Doll",
      price: -1,
      stock: 1,
    });
    expect(r.ok).toBe(false);
    expect(m.createP).not.toHaveBeenCalled();
  });

  it("createAdminProductAction rejects negative stock", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await createAdminProductAction({
      name: "Doll",
      price: 100,
      stock: -5,
    });
    expect(r.ok).toBe(false);
  });

  it("createAdminProductAction posts to server + revalidates", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    m.createP.mockResolvedValue({
      ok: true,
      data: {
        id: "p_1",
        name: "Doll",
        price: 50000,
        category: null,
        image_url: null,
        stock: 10,
        is_deleted: false,
        created_at: "2026-05-26T00:00:00Z",
      },
    });
    const r = await createAdminProductAction({
      name: "Doll",
      price: 50000,
      stock: 10,
    });
    expect(r.ok).toBe(true);
    expect(m.revalidate).toHaveBeenCalledWith("/dashboard/commerce/products");
  });

  it("deleteAdminProductAction requires session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await deleteAdminProductAction({ id: "p_1" });
    expect(r.ok).toBe(false);
    expect(m.deleteP).not.toHaveBeenCalled();
  });

  it("updateAdminProductAction surfaces server error", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    m.updateP.mockResolvedValue({
      ok: false,
      code: "ERR_NOT_FOUND",
      message: "not_found",
      status: 404,
    });
    const r = await updateAdminProductAction({
      id: "p_1",
      patch: { stock: 0 },
    });
    expect(r.ok).toBe(false);
    expect(m.revalidate).not.toHaveBeenCalled();
  });

  it("listAdminProductsAction forwards filters", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    m.listP.mockResolvedValue({
      ok: true,
      data: { items: [], total: 0, page: 1, page_size: 25 },
    });
    const r = await listAdminProductsAction({
      category: "doll",
      only_zero_stock: true,
    });
    expect(r.ok).toBe(true);
    expect(m.listP).toHaveBeenCalledWith({
      jwt: "j",
      category: "doll",
      only_zero_stock: true,
    });
  });
});

describe("commerceAdmin orders — auth + flow", () => {
  it("listAdminOrdersAction returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await listAdminOrdersAction({});
    expect(r.ok).toBe(false);
    expect(m.listO).not.toHaveBeenCalled();
  });

  it("getAdminOrderAction returns data", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    m.getO.mockResolvedValue({
      ok: true,
      data: {
        order: {
          id: "o_1",
          user_id: "u_1",
          user_email: null,
          total: 1000,
          status: "paid",
          item_count: 1,
          created_at: "2026-05-26T00:00:00Z",
        },
        items: [],
      },
    });
    const r = await getAdminOrderAction({ id: "o_1" });
    expect(r.ok).toBe(true);
  });

  it("updateAdminOrderStatusAction revalidates on success", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    m.updateO.mockResolvedValue({
      ok: true,
      data: {
        id: "o_1",
        user_id: "u_1",
        user_email: null,
        total: 1000,
        status: "shipping",
        item_count: 1,
        created_at: "2026-05-26T00:00:00Z",
      },
    });
    const r = await updateAdminOrderStatusAction({
      id: "o_1",
      status: "shipping",
      reason: "송장 입력",
    });
    expect(r.ok).toBe(true);
    expect(m.revalidate).toHaveBeenCalledWith("/dashboard/commerce/orders");
  });

  it("updateAdminOrderStatusAction surfaces server error without revalidating", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    m.updateO.mockResolvedValue({
      ok: false,
      code: "ERR_NETWORK",
      message: "ERR_NETWORK",
      status: 0,
    });
    const r = await updateAdminOrderStatusAction({
      id: "o_1",
      status: "done",
      reason: "고객 수령 확인",
    });
    expect(r.ok).toBe(false);
    expect(m.revalidate).not.toHaveBeenCalled();
  });
});
