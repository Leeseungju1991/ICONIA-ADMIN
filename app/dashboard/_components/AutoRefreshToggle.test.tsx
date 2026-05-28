import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent } from "@testing-library/react";
import { AutoRefreshToggle } from "./AutoRefreshToggle";

afterEach(cleanup);

describe("AutoRefreshToggle", () => {
  it("renders OFF state with em-dash for last refreshed when null", () => {
    render(
      <AutoRefreshToggle
        enabled={false}
        onToggle={() => {}}
        lastRefreshedAt={null}
      />,
    );
    expect(screen.getByText("OFF")).toBeInTheDocument();
    expect(screen.getByTestId("auto-refresh-last").textContent).toBe("—");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");
  });

  it("renders ON state with formatted time", () => {
    const ts = new Date(2026, 4, 28, 14, 5, 3).getTime();
    render(
      <AutoRefreshToggle enabled onToggle={() => {}} lastRefreshedAt={ts} />,
    );
    expect(screen.getByText("ON")).toBeInTheDocument();
    expect(screen.getByTestId("auto-refresh-last").textContent).toBe("14:05:03");
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("invokes onToggle with negated value on click", () => {
    const onToggle = vi.fn();
    render(
      <AutoRefreshToggle
        enabled={false}
        onToggle={onToggle}
        lastRefreshedAt={null}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it("invokes onToggle(false) when currently ON and clicked", () => {
    const onToggle = vi.fn();
    render(
      <AutoRefreshToggle enabled onToggle={onToggle} lastRefreshedAt={null} />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it("shows configurable interval in label", () => {
    render(
      <AutoRefreshToggle
        enabled={false}
        onToggle={() => {}}
        lastRefreshedAt={null}
        intervalSec={30}
      />,
    );
    expect(screen.getByText(/자동 갱신 \(30s\)/)).toBeInTheDocument();
  });
});
