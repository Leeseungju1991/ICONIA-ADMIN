import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { PostInspector } from "./PostInspector";
import { mockFeedPost } from "@/lib/mockFeed";

afterEach(cleanup);

describe("PostInspector", () => {
  it("renders empty state when post is null", () => {
    render(<PostInspector post={null} role="viewer" onAction={() => {}} />);
    expect(screen.getByText("왼쪽 피드에서 게시물을 선택하세요")).toBeTruthy();
  });

  it("disables all action buttons for viewer role", () => {
    const post = { ...mockFeedPost("post_0000"), status: "visible" as const };
    render(<PostInspector post={post} role="viewer" onAction={() => {}} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(3); // hide, takedown, hide_all_by_user (unhide hidden when visible)
    for (const b of buttons) {
      expect((b as HTMLButtonElement).disabled).toBe(true);
    }
  });

  it("calls onAction('takedown') when secops clicks 영구 차단 on a visible post", () => {
    const post = { ...mockFeedPost("post_0000"), status: "visible" as const };
    const spy = vi.fn();
    render(<PostInspector post={post} role="secops" onAction={spy} />);
    const btn = screen.getByRole("button", { name: "영구 차단" }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(spy).toHaveBeenCalledWith("takedown");
  });
});
