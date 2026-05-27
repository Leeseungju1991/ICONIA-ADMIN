import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { HeroBanner } from "./HeroBanner";

afterEach(cleanup);

describe("HeroBanner", () => {
  it("renders title and subtitle", () => {
    render(<HeroBanner mode="ok" title="시스템 정상" subtitle="할 일 없음" />);
    expect(screen.getByText("시스템 정상")).toBeTruthy();
    expect(screen.getByText("할 일 없음")).toBeTruthy();
  });
  it("renders CTA link when provided", () => {
    render(<HeroBanner mode="critical" title="장애" subtitle="복구" cta={{ label: "열기", href: "/dashboard/ops" }} />);
    const link = screen.getByRole("link", { name: "열기" }) as HTMLAnchorElement;
    expect(link.getAttribute("href")).toBe("/dashboard/ops");
  });
});
