import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";

// ForceLogoutButton 은 이제 ConfirmActionForm 으로 wrap — window.confirm + prompt 가
// 사유 수집을 처리한다. 본 테스트는 wrapper 결합 (button render, confirm/prompt gate,
// 사유 전달) 만 검증 — action 자체 동작은 lib/actions/forceLogoutUser.test 에서 다룬다.

const forceLogoutUserAction = vi.fn();
vi.mock("@/lib/actions/forceLogoutUser", () => ({
  forceLogoutUserAction: (...a: unknown[]) => forceLogoutUserAction(...a),
}));

import { ForceLogoutButton } from "./ForceLogoutButton";

beforeEach(() => {
  forceLogoutUserAction.mockReset();
  forceLogoutUserAction.mockResolvedValue({ status: "idle" });
});

describe("ForceLogoutButton", () => {
  it("renders the danger button labeled 강제 로그아웃", () => {
    render(<ForceLogoutButton userId="u1" />);
    expect(screen.getByRole("button", { name: /강제 로그아웃/ })).toBeInTheDocument();
  });

  it("aborts when user cancels the confirm dialog (no action call)", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ForceLogoutButton userId="u1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /강제 로그아웃/ }));
    });
    expect(forceLogoutUserAction).not.toHaveBeenCalled();
  });

  it("aborts when reason is too short (< 5 chars)", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "prompt").mockReturnValue("abc");
    vi.spyOn(window, "alert").mockImplementation(() => undefined);
    render(<ForceLogoutButton userId="u1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /강제 로그아웃/ }));
    });
    expect(forceLogoutUserAction).not.toHaveBeenCalled();
  });

  it("calls forceLogoutUserAction with user_id + reason after confirm + 5+ char prompt", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.spyOn(window, "prompt").mockReturnValue("Off-boarding 정책 위반");
    render(<ForceLogoutButton userId="u1" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /강제 로그아웃/ }));
    });
    // flush startTransition
    await act(async () => {
      await Promise.resolve();
    });
    expect(forceLogoutUserAction).toHaveBeenCalledTimes(1);
    const passed = forceLogoutUserAction.mock.calls[0][0] as FormData;
    expect(passed).toBeInstanceOf(FormData);
    expect(passed.get("user_id")).toBe("u1");
    expect(passed.get("reason")).toBe("Off-boarding 정책 위반");
  });
});
