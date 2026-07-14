import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

vi.mock("@/lib/actions/seed", () => ({
  getSeedStatusAction: vi.fn(),
  runSeedAction: vi.fn(),
}));

import { getSeedStatusAction } from "@/lib/actions/seed";
import OpsSeedPage from "./page";

const mStatus = getSeedStatusAction as unknown as ReturnType<typeof vi.fn>;

afterEach(cleanup);
beforeEach(() => mStatus.mockReset());

describe("OpsSeedPage — render states", () => {
  it("shows empty counts message when server returns blank counts", async () => {
    mStatus.mockResolvedValue({
      ok: true,
      data: {
        last_run_at: null,
        last_run_by: null,
        counts: {},
      },
    });
    render(<OpsSeedPage />);
    await waitFor(() => {
      expect(
        screen.getByText(/아직 Seed 가 한 번도 실행되지 않았거나/),
      ).toBeInTheDocument();
    });
    // 2026-06-02 R-J: 라운드 14 단순화로 패널 제목이 "시드 데이터 카테고리별 개수" 로 변경됨.
    expect(screen.getByText("시드 데이터 카테고리별 개수")).toBeInTheDocument();
  });

  it("shows preparing banner on ERR_NETWORK", async () => {
    mStatus.mockResolvedValue({
      ok: false,
      message: "ERR_NETWORK",
      code: "ERR_NETWORK",
    });
    render(<OpsSeedPage />);
    await waitFor(() => {
      expect(screen.getByText("준비 중")).toBeInTheDocument();
    });
  });

  it("renders categories when status has counts", async () => {
    mStatus.mockResolvedValue({
      ok: true,
      data: {
        last_run_at: "2026-05-26T03:00:00Z",
        last_run_by: "privacy@example.com",
        duration_ms: 1234,
        counts: { users: 100, products: 12 },
      },
    });
    render(<OpsSeedPage />);
    await waitFor(() => {
      expect(screen.getByText("users")).toBeInTheDocument();
    });
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("products")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
  });
});
