import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";

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
    // 2026-06-05 — 정합: "피드 게시물" 문구는 메인 PanelCard 제목 외에 신규 패널
    // ("미디어 일괄 주입" description, BulkDeleteEmptyPanel 설명) 등에도 등장하므로
    // 더 구체적인 heading 매칭을 사용한다. getAllByText 로 1개 이상이면 충분.
    expect(screen.getAllByText(/피드 게시물/).length).toBeGreaterThan(0);
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
    // 2026-06-05 — 정합: ID 컬럼은 author_email ?? author_id 를 노출.
    // 작성자 컬럼은 author_display_name ?? author_handle ?? author_id (handle 표시).
    // body_excerpt 로 row 존재 검증.
    await waitFor(() => {
      expect(screen.getByText("안녕하세요")).toBeInTheDocument();
    });
    // mock 은 author_email 미설정 → ID 셀이 author_id "u_1" 노출.
    expect(screen.getAllByText("u_1").length).toBeGreaterThan(0);
    // mock 은 author_display_name 미설정 → 작성자 셀이 handle "alice" 노출.
    expect(screen.getByText("alice")).toBeInTheDocument();
  });

  it("renders auto-refresh toggle defaulting to OFF", async () => {
    mList.mockResolvedValue({
      ok: true,
      data: { items: [], total: 0, page: 1, page_size: 25 },
    });
    render(<FeedPage />);
    await waitFor(() => {
      expect(screen.getByTestId("auto-refresh-toggle")).toBeInTheDocument();
    });
    const sw = screen.getByTestId("auto-refresh-switch");
    expect(sw).toHaveAttribute("data-state", "off");
  });

  it("auto-refresh toggle flips state on click", async () => {
    mList.mockResolvedValue({
      ok: true,
      data: { items: [], total: 0, page: 1, page_size: 25 },
    });
    render(<FeedPage />);
    const sw = await screen.findByTestId("auto-refresh-switch");
    expect(sw).toHaveAttribute("data-state", "off");
    fireEvent.click(sw);
    await waitFor(() => {
      expect(screen.getByTestId("auto-refresh-switch")).toHaveAttribute("data-state", "on");
    });
  });
});
