import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { SummaryCardCarousel } from "./SummaryCardCarousel";

afterEach(cleanup);

describe("SummaryCardCarousel", () => {
  it("renders each card title and link", () => {
    render(
      <SummaryCardCarousel
        cards={[
          { id: "a", title: "신고", count: 3, hint: "검토 필요", href: "/dashboard/reports" },
          { id: "b", title: "앱 에러", count: 12, hint: "24h", href: "/dashboard/app-errors" },
        ]}
      />,
    );
    expect(screen.getByText("신고")).toBeTruthy();
    expect(screen.getByText("앱 에러")).toBeTruthy();
    expect((screen.getByRole("link", { name: /신고/ }) as HTMLAnchorElement).getAttribute("href")).toBe("/dashboard/reports");
  });
});
