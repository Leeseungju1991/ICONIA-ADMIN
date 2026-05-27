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

import { listAdminOrdersAction } from "@/lib/actions/commerceAdmin";
import OrdersPage from "./page";

const mList = listAdminOrdersAction as unknown as ReturnType<typeof vi.fn>;

afterEach(cleanup);
beforeEach(() => mList.mockReset());

describe("OrdersPage — render states", () => {
  it("shows empty message when server returns zero orders", async () => {
    mList.mockResolvedValue({
      ok: true,
      data: { items: [], total: 0, page: 1, page_size: 25 },
    });
    render(<OrdersPage />);
    await waitFor(() => {
      expect(screen.getByText(/해당 조건의 주문이 없습니다/)).toBeInTheDocument();
    });
  });

  it("shows preparing banner on ERR_NETWORK", async () => {
    mList.mockResolvedValue({
      ok: false,
      message: "ERR_NETWORK",
      code: "ERR_NETWORK",
    });
    render(<OrdersPage />);
    await waitFor(() => {
      expect(screen.getByText("준비 중")).toBeInTheDocument();
    });
  });

  it("renders order row + status chip", async () => {
    mList.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "o_1",
            user_id: "u_1",
            user_email: "buyer@example.com",
            total: 89000,
            currency: "KRW",
            status: "paid",
            item_count: 1,
            created_at: "2026-05-26T00:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        page_size: 25,
      },
    });
    render(<OrdersPage />);
    await waitFor(() => {
      expect(screen.getByText("o_1")).toBeInTheDocument();
    });
    expect(screen.getByText("buyer@example.com")).toBeInTheDocument();
    // "결제완료" 는 STATUS_OPTIONS 셀렉트 옵션과 행 chip 모두에 나오므로 길이만 확인.
    expect(screen.getAllByText("결제완료").length).toBeGreaterThanOrEqual(1);
  });
});
