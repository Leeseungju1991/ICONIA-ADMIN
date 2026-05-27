import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TopbarRich, classifyQuery } from "./TopbarRich";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: (href: string) => (globalThis as any).__pushed = href }),
}));

describe("classifyQuery", () => {
  it("classifies email → user-360", () => expect(classifyQuery("a@b.c")).toBe("user-360"));
  it("classifies serial → user-360", () => expect(classifyQuery("IC-ABCD1234")).toBe("user-360"));
  it("classifies UUID → user-360", () => expect(classifyQuery("12345678-1234-1234-1234-123456789abc")).toBe("user-360"));
  it("falls back to cs", () => expect(classifyQuery("홍길동")).toBe("cs"));
});

describe("TopbarRich", () => {
  it("submitting email routes to /dashboard/user-360", () => {
    render(<TopbarRich title="대시보드" subtitle="" operatorEmail="me@x" />);
    fireEvent.change(screen.getByPlaceholderText(/검색/), { target: { value: "u@x.com" } });
    fireEvent.submit(screen.getByRole("search"));
    expect((globalThis as any).__pushed).toBe("/dashboard/user-360?q=u%40x.com");
  });
});
