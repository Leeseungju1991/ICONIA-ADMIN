import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/commerceAdmin", () => ({
  listAdminProductsAction: vi.fn(),
  createAdminProductAction: vi.fn(),
  updateAdminProductAction: vi.fn(),
  deleteAdminProductAction: vi.fn(),
  listAdminOrdersAction: vi.fn(),
  getAdminOrderAction: vi.fn(),
  updateAdminOrderStatusAction: vi.fn(),
}));

import { listAdminProductsAction } from "@/lib/actions/commerceAdmin";
import ProductsPage from "./page";

const mList = listAdminProductsAction as unknown as ReturnType<typeof vi.fn>;

afterEach(cleanup);
beforeEach(() => mList.mockReset());

describe("ProductsPage — render states", () => {
  it("shows empty message when server returns no items", async () => {
    mList.mockResolvedValue({
      ok: true,
      data: { items: [], total: 0, page: 1, page_size: 25 },
    });
    render(<ProductsPage />);
    await waitFor(() => {
      expect(screen.getByText(/해당 조건의 상품이 없습니다/)).toBeInTheDocument();
    });
    expect(screen.getByText(/상품 목록/)).toBeInTheDocument();
  });

  it("shows graceful preparing banner on ERR_NETWORK", async () => {
    mList.mockResolvedValue({
      ok: false,
      message: "ERR_NETWORK",
      code: "ERR_NETWORK",
    });
    render(<ProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("준비 중")).toBeInTheDocument();
    });
  });

  it("renders product row when server returns items", async () => {
    mList.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "p_1",
            name: "SOUL Doll",
            price: 89000,
            currency: "KRW",
            category: "doll",
            image_url: null,
            stock: 10,
            is_deleted: false,
            created_at: "2026-05-26T00:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        page_size: 25,
      },
    });
    render(<ProductsPage />);
    await waitFor(() => {
      expect(screen.getByText("SOUL Doll")).toBeInTheDocument();
    });
  });
});
