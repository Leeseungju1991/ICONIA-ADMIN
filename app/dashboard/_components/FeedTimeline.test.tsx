import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
import { FeedTimeline } from "./FeedTimeline";
import { mockFeedList } from "@/lib/mockFeed";

afterEach(cleanup);

const items = mockFeedList("latest").items.slice(0, 3);

describe("FeedTimeline", () => {
  it("renders empty state when items is empty", () => {
    render(
      <FeedTimeline
        items={[]}
        tab="latest"
        onTab={() => {}}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    expect(screen.getByText("표시할 게시물이 없습니다")).toBeInTheDocument();
  });

  it("invokes onTab with the tab key when a tab button is clicked", () => {
    const onTab = vi.fn();
    render(
      <FeedTimeline
        items={items}
        tab="latest"
        onTab={onTab}
        selectedId={null}
        onSelect={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "신고됨" }));
    expect(onTab).toHaveBeenCalledWith("reported");
  });

  it("invokes onSelect with the post id when a card is clicked", () => {
    const onSelect = vi.fn();
    render(
      <FeedTimeline
        items={items}
        tab="latest"
        onTab={() => {}}
        selectedId={null}
        onSelect={onSelect}
      />,
    );
    const list = screen.getByRole("list");
    const cardButtons = within(list).getAllByRole("button");
    fireEvent.click(cardButtons[0]);
    expect(onSelect).toHaveBeenCalledWith(items[0].id);
  });
});
