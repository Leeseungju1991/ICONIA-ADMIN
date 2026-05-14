import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { DisabledActionButton } from "./DisabledActionButton";

describe("DisabledActionButton", () => {
  it("renders a disabled button with default title", () => {
    render(<DisabledActionButton buttonLabel="비활성화" />);
    const btn = screen.getByRole("button", { name: /비활성화/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute("title", "권한 없음");
    expect(btn).toHaveAttribute("aria-disabled", "true");
    expect(btn).toHaveAttribute("data-testid", "role-gated-disabled");
  });

  it("respects custom title and className", () => {
    render(
      <DisabledActionButton
        buttonLabel="숨김"
        buttonClassName="btn small foo"
        title="역할이 낮습니다"
      />,
    );
    const btn = screen.getByRole("button", { name: /숨김/ });
    expect(btn).toHaveAttribute("title", "역할이 낮습니다");
    expect(btn).toHaveClass("btn", "small", "foo");
  });

  it("aria-label combines label + title for screen readers", () => {
    render(<DisabledActionButton buttonLabel="강제 언페어링" />);
    const btn = screen.getByRole("button", {
      name: "강제 언페어링 — 권한 없음",
    });
    expect(btn).toBeDisabled();
  });
});
