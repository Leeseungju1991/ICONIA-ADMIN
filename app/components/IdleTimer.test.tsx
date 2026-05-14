import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

// IdleTimer 가 import 하는 server action 을 mock — client unit test 는
// 실제 server action 호출 대신 spy 만 검증.
vi.mock("@/lib/actions/idleLogout", () => ({
  idleLogoutAction: vi.fn(),
}));

import { IdleTimer } from "./IdleTimer";
import { idleLogoutAction } from "@/lib/actions/idleLogout";

const mockedIdleLogout = idleLogoutAction as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.useFakeTimers();
  mockedIdleLogout.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("IdleTimer", () => {
  it("renders nothing initially", () => {
    render(<IdleTimer timeoutMinutes={30} />);
    expect(screen.queryByTestId("idle-warning")).not.toBeInTheDocument();
  });

  it("shows warning dialog at (timeout - 5min) and counts down", () => {
    render(<IdleTimer timeoutMinutes={10} />);
    // warning at 10min - 5min = 5min
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(screen.getByTestId("idle-warning")).toBeInTheDocument();
    // countdown initial value ≈ 5분 표기
    expect(screen.getByTestId("idle-countdown").textContent).toMatch(/5분/);
  });

  it("calls idleLogoutAction when full timeout elapses without activity", () => {
    render(<IdleTimer timeoutMinutes={10} />);
    // advance full 10 minutes (warning fires at 5min, logout at 10min).
    act(() => {
      vi.advanceTimersByTime(10 * 60 * 1000 + 100);
    });
    expect(mockedIdleLogout).toHaveBeenCalled();
  });

  it("does not show warning before warning threshold", () => {
    render(<IdleTimer timeoutMinutes={10} />);
    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000); // before warning at 5min
    });
    expect(screen.queryByTestId("idle-warning")).not.toBeInTheDocument();
  });

  it("'계속 사용' button dismisses the warning and resets the timer", () => {
    render(<IdleTimer timeoutMinutes={10} />);
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000); // open warning
    });
    expect(screen.getByTestId("idle-warning")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("idle-continue"));
    expect(screen.queryByTestId("idle-warning")).not.toBeInTheDocument();

    // 다시 advance — 5min 이후에 또 warning 이 떠야 함 (re-armed).
    act(() => {
      vi.advanceTimersByTime(5 * 60 * 1000);
    });
    expect(screen.getByTestId("idle-warning")).toBeInTheDocument();
    expect(mockedIdleLogout).not.toHaveBeenCalled();
  });

  it("activity events before warning reset the timer", () => {
    render(<IdleTimer timeoutMinutes={10} />);
    // advance 4 minutes (no warning yet).
    act(() => {
      vi.advanceTimersByTime(4 * 60 * 1000);
    });
    expect(screen.queryByTestId("idle-warning")).not.toBeInTheDocument();

    // 활동 — timer 리셋.
    act(() => {
      // throttle 회피를 위해 약간 더 진행 후 keydown
      vi.advanceTimersByTime(2000);
      window.dispatchEvent(new KeyboardEvent("keydown"));
    });

    // 4분 + 2초 + 2분 = 6분 2초 — 원래라면 warning 이미 떠야 하지만 리셋되어 안 뜸.
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(screen.queryByTestId("idle-warning")).not.toBeInTheDocument();
  });
});
