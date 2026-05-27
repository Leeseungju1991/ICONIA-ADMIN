import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CommunityHealthChips } from "./CommunityHealthChips";
import { mockCommunityHealth } from "@/lib/mockFeed";

describe("CommunityHealthChips", () => {
  it("renders all 4 KPI chip labels", () => {
    const health = mockCommunityHealth();
    render(<CommunityHealthChips health={health} />);
    expect(screen.getByText("24h 게시물")).toBeTruthy();
    expect(screen.getByText("활성 작성자(DAU)")).toBeTruthy();
    expect(screen.getByText("신고 대기")).toBeTruthy();
    expect(screen.getByText("7일 takedown")).toBeTruthy();
  });
});
