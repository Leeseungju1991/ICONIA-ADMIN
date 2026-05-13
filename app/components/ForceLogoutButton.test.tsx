import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { formActionsReactDomMock, submitLastFormAction } from "../../test/helpers/formActions";

vi.mock("react-dom", async (orig) => formActionsReactDomMock(await orig()));

const forceLogoutUserAction = vi.fn();
vi.mock("@/lib/actions/forceLogoutUser", () => ({
  forceLogoutUserAction: (...a: unknown[]) => forceLogoutUserAction(...a),
}));

import { ForceLogoutButton } from "./ForceLogoutButton";

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

beforeEach(() => {
  forceLogoutUserAction.mockReset();
  forceLogoutUserAction.mockResolvedValue({ status: "idle" });
  globalThis.__lastFormAction__ = undefined;
});

describe("ForceLogoutButton", () => {
  it("renders the button with the user_id hidden field", () => {
    const { container } = render(<ForceLogoutButton userId="u1" />);
    expect(screen.getByRole("button", { name: /강제 로그아웃/ })).toBeInTheDocument();
    expect(container.querySelector('input[name="user_id"]')).toHaveValue("u1");
  });

  it("submits and calls forceLogoutUserAction with only the FormData", async () => {
    render(<ForceLogoutButton userId="u1" />);
    await act(async () => {
      submitLastFormAction(fd({ user_id: "u1" }));
    });
    expect(forceLogoutUserAction).toHaveBeenCalledTimes(1);
    // wrapper drops the prevState arg — action receives FormData as its only arg
    const passed = forceLogoutUserAction.mock.calls[0][0] as FormData;
    expect(passed).toBeInstanceOf(FormData);
    expect(passed.get("user_id")).toBe("u1");
  });

  it("shows the success notice when the action returns an idle state with a message", async () => {
    forceLogoutUserAction.mockResolvedValue({ status: "idle", message: "3개 세션을 종료했습니다." });
    render(<ForceLogoutButton userId="u1" />);
    await act(async () => {
      submitLastFormAction(fd({ user_id: "u1" }));
    });
    expect(await screen.findByText("3개 세션을 종료했습니다.")).toBeInTheDocument();
  });

  it("shows the localized error message when the action returns an error", async () => {
    forceLogoutUserAction.mockResolvedValue({ status: "error", code: "ERR_USER_NOT_FOUND" });
    render(<ForceLogoutButton userId="u1" />);
    await act(async () => {
      submitLastFormAction(fd({ user_id: "u1" }));
    });
    const alert = await screen.findByRole("alert");
    // ERR_USER_NOT_FOUND has no specific mapping → falls back to the default message.
    expect(alert).toHaveTextContent("알 수 없는 오류가 발생했습니다.");
  });
});
