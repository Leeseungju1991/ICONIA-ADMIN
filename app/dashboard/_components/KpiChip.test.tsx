import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { KpiChip } from "./KpiChip";

describe("KpiChip", () => {
  it("renders label and value", () => {
    render(<KpiChip label="활성 디바이스" value="2,840" sub="2,840 / 3,200 온라인" tone="indigo" icon="device" />);
    expect(screen.getByText("활성 디바이스")).toBeTruthy();
    expect(screen.getByText("2,840")).toBeTruthy();
    expect(screen.getByText("2,840 / 3,200 온라인")).toBeTruthy();
  });
});
