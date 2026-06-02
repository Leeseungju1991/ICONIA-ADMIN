// 2026-06-02 — getAdminCommerceProductAction 의 SERVER 단건 endpoint 정합 검증.
//
// 이전 구현은 listAdminCommerceProducts({ page_size: 200 }) 후 client-side filter
// 였다. SERVER 정식 GET /api/v1/admin/commerce/products/:id 추가에 맞춰 본 action
// 이 단건 호출로 단순화되고 `recent_orders_count` 를 응답에서 직접 노출한다.

import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("@/lib/adminApi", () => ({
  listAdminCommerceProducts: vi.fn(),
  createAdminCommerceProduct: vi.fn(),
  deleteAdminCommerceProduct: vi.fn(),
  getAdminCommerceProduct: vi.fn(),
}));

import {
  getAdminCommerceProduct,
  listAdminCommerceProducts,
} from "@/lib/adminApi";
import { getAdminCommerceProductAction } from "./adminCommerce";

const mockedGet = getAdminCommerceProduct as unknown as ReturnType<typeof vi.fn>;
const mockedList =
  listAdminCommerceProducts as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mockedGet.mockReset();
  mockedList.mockReset();
});

describe("getAdminCommerceProductAction", () => {
  it("세션 만료 시 server 호출 안 함", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await getAdminCommerceProductAction({ id: "p-1" });
    expect(r.ok).toBe(false);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("id 누락 시 거부", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt" });
    const r = await getAdminCommerceProductAction({ id: "  " });
    expect(r.ok).toBe(false);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("SERVER 단건 endpoint 만 호출 (200건 list fetch 제거)", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt" });
    mockedGet.mockResolvedValue({
      ok: true,
      data: {
        id: "p-1",
        name: "테스트 상품",
        price: "12000",
        currency: "KRW",
        stock_quantity: 5,
        stock_status: "instock",
        primary_image: "https://cdn/x.jpg",
        status: "active",
        created_at: "2026-06-01T00:00:00Z",
        updated_at: "2026-06-01T00:00:00Z",
        description: "상세 설명",
        recent_orders_count: 7,
      },
    });
    const r = await getAdminCommerceProductAction({ id: "p-1" });
    expect(mockedList).not.toHaveBeenCalled();
    expect(mockedGet).toHaveBeenCalledWith({ jwt: "jwt", id: "p-1" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.product.id).toBe("p-1");
      expect(r.product.name).toBe("테스트 상품");
      expect(r.product.price).toBe(12000);
      expect(r.product.stock).toBe(5);
      expect(r.product.stock_status).toBe("instock");
      expect(r.recent_orders_count).toBe(7);
    }
  });

  it("recent_orders_count 가 응답에 없으면 null", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt" });
    mockedGet.mockResolvedValue({
      ok: true,
      data: {
        id: "p-2",
        name: "두번째 상품",
        price: 9000,
        // recent_orders_count 없음 — server 가 산출하지 못하거나 신규 미배포.
      },
    });
    const r = await getAdminCommerceProductAction({ id: "p-2" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.recent_orders_count).toBeNull();
  });

  it("SERVER 에러를 그대로 surface (404 등)", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt" });
    mockedGet.mockResolvedValue({
      ok: false,
      code: "ERR_NOT_FOUND",
      message: "not found",
      status: 404,
    });
    const r = await getAdminCommerceProductAction({ id: "p-x" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.code).toBe("ERR_NOT_FOUND");
    }
  });
});
