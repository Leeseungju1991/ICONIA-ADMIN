import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { formActionsReactDomMock, submitLastFormAction } from "../../test/helpers/formActions";

vi.mock("react-dom", async (orig) => formActionsReactDomMock(await orig()));

const mfaAction = vi.fn();
vi.mock("@/lib/actions/mfa", () => ({
  mfaAction: (...a: unknown[]) => mfaAction(...a),
}));

import { MfaForm } from "./MfaForm";

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

beforeEach(() => {
  mfaAction.mockReset();
  mfaAction.mockResolvedValue({ status: "idle" });
  globalThis.__lastFormAction__ = undefined;
});

describe("MfaForm", () => {
  it("renders the TOTP field by default with the hidden token/mode fields", () => {
    const { container } = render(<MfaForm token="tok-abc" />);
    expect(screen.getByLabelText("TOTP 6자리 코드")).toBeInTheDocument();
    expect(container.querySelector('input[name="token"]')).toHaveValue("tok-abc");
    expect(container.querySelector('input[name="mode"]')).toHaveValue("totp");
  });

  it("toggles to recovery-code mode and back", () => {
    const { container } = render(<MfaForm token="tok-abc" />);
    fireEvent.click(screen.getByRole("button", { name: "복구 코드로 입력" }));
    expect(screen.getByLabelText("복구 코드")).toBeInTheDocument();
    expect(container.querySelector('input[name="mode"]')).toHaveValue("recovery");
    fireEvent.click(screen.getByRole("button", { name: "TOTP 코드로 입력" }));
    expect(screen.getByLabelText("TOTP 6자리 코드")).toBeInTheDocument();
  });

  it("calls mfaAction on submit with the token + mode + code", async () => {
    render(<MfaForm token="tok-abc" />);
    await act(async () => {
      submitLastFormAction(fd({ token: "tok-abc", mode: "totp", code: "123456" }));
    });
    expect(mfaAction).toHaveBeenCalledTimes(1);
    const passed = mfaAction.mock.calls[0][1] as FormData;
    expect(passed.get("token")).toBe("tok-abc");
    expect(passed.get("mode")).toBe("totp");
    expect(passed.get("code")).toBe("123456");
  });

  it("renders the error alert with the localized message on action error", async () => {
    mfaAction.mockResolvedValue({ status: "error", code: "ERR_OPERATOR_MFA_INVALID" });
    render(<MfaForm token="tok-abc" />);
    await act(async () => {
      submitLastFormAction(fd({ token: "tok-abc", mode: "totp", code: "111111" }));
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("인증 코드가 올바르지 않습니다.");
  });
});
