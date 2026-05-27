import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";

// Mock server actions BEFORE importing page. The page is a client component but
// imports the actions module which carries "use server" — vitest needs the mock.
vi.mock("@/lib/actions/feed", () => ({
  listFeedPostsAction: vi.fn(),
  getFeedPostAction: vi.fn(),
  patchFeedPostAction: vi.fn(),
  deleteFeedPostAction: vi.fn(),
}));

import { listFeedPostsAction } from "@/lib/actions/feed";
import FeedPage from "./page";

const mList = listFeedPostsAction as unknown as ReturnType<typeof vi.fn>;

afterEach(cleanup);
beforeEach(() => {
  mList.mockReset();
});

describe("FeedPage — render states", () => {
  it("renders empty state when server returns zero items", async () => {
    mList.mockResolvedValue({
      ok: true,
      data: { items: [], total: 0, page: 1, page_size: 25 },
    });
    render(<FeedPage />);
    await waitFor(() => {
      expect(screen.getByText(/해당 조건의 게시물이 없습니다/)).toBeInTheDocument();
    });
    expect(screen.getByText(/피드 게시물/)).toBeInTheDocument();
  });

  it('renders "준비 중" graceful banner on ERR_NETWORK', async () => {
    mList.mockResolvedValue({
      ok: false,
      message: "ERR_NETWORK",
      code: "ERR_NETWORK",
    });
    render(<FeedPage />);
    await waitFor(() => {
      expect(screen.getByText("준비 중")).toBeInTheDocument();
    });
  });

  it("renders silently (no error text) on non-network error", async () => {
    mList.mockResolvedValue({
      ok: false,
      message: "boom",
      code: "ERR_UNKNOWN",
    });
    render(<FeedPage />);
    // 2026-05-27 — 사용자 요구: 에러 텍스트 노출 금지. silent.
    await waitFor(() => {
      expect(screen.queryByText(/조회 실패/)).toBeNull();
    });
  });

  it("renders rows when server returns items", async () => {
    mList.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "p_1",
            author_id: "u_1",
            author_handle: "alice",
            body: "안녕하세요",
            body_excerpt: "안녕하세요",
            comments_count: 3,
            is_hidden: false,
            created_at: "2026-05-26T00:00:00Z",
          },
        ],
        total: 1,
        page: 1,
        page_size: 25,
      },
    });
    render(<FeedPage />);
    await waitFor(() => {
      expect(screen.getByText("p_1")).toBeInTheDocument();
    });
    expect(screen.getByText("alice")).toBeInTheDocument();
  });
});
