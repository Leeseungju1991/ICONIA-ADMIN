import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { UserSnapshotGrid } from "./UserSnapshotGrid";
import { mockUser360Snapshot } from "@/lib/mockUser360";

afterEach(cleanup);

describe("UserSnapshotGrid", () => {
  it("renders four quadrants", () => {
    render(<UserSnapshotGrid snapshot={mockUser360Snapshot("u@x")} role="superadmin" onAction={() => {}} />);
    expect(screen.getByText("HW")).toBeTruthy();
    expect(screen.getByText("Server")).toBeTruthy();
    expect(screen.getByText("AI")).toBeTruthy();
    expect(screen.getByText("APP")).toBeTruthy();
  });
  it("disables strong actions for viewer", () => {
    render(<UserSnapshotGrid snapshot={mockUser360Snapshot("u@x")} role="viewer" onAction={() => {}} />);
    const btns = screen.getAllByRole("button");
    for (const b of btns) expect((b as HTMLButtonElement).disabled).toBe(true);
  });
  it("calls onAction with action key when cs clicks force-logout", () => {
    const spy = vi.fn();
    render(<UserSnapshotGrid snapshot={mockUser360Snapshot("u@x")} role="cs" onAction={spy} />);
    fireEvent.click(screen.getByRole("button", { name: /강제 로그아웃/ }));
    expect(spy).toHaveBeenCalledWith("force_logout", expect.anything());
  });
});
