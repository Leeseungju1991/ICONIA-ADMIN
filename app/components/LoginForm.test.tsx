import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { formActionsReactDomMock, submitLastFormAction } from "../../test/helpers/formActions";

// react-dom@18.3.1 in node_modules does not export useFormState/useFormStatus
// (Next.js aliases react-dom to a build that does). Shim them for the test.
vi.mock("react-dom", async (orig) => formActionsReactDomMock(await orig()));

// loginAction is a "use server" action that pulls in next/navigation + next/headers;
// mock the module so the client component can be rendered in jsdom.
const loginAction = vi.fn();
vi.mock("@/lib/actions/login", () => ({
  loginAction: (...a: unknown[]) => loginAction(...a),
}));

import { LoginForm } from "./LoginForm";

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

beforeEach(() => {
  loginAction.mockReset();
  loginAction.mockResolvedValue({ status: "idle" });
  globalThis.__lastFormAction__ = undefined;
});

describe("LoginForm", () => {
  it("renders email + password fields and the submit button", () => {
    render(<LoginForm />);
    expect(screen.getByLabelText("이메일")).toBeInTheDocument();
    expect(screen.getByLabelText("비밀번호")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "로그인" })).toBeInTheDocument();
  });

  it("shows the reason notice when a known reason is passed", () => {
    render(<LoginForm reason="expired" />);
    expect(screen.getByText(/세션이 만료/)).toBeInTheDocument();
  });

  it("renders no notice when the reason is unknown", () => {
    render(<LoginForm reason="bogus" />);
    expect(screen.queryByText(/세션이 만료/)).toBeNull();
  });

  it("calls loginAction with the form data on submit", async () => {
    render(<LoginForm />);
    await act(async () => {
      submitLastFormAction(fd({ email: "a@b.com", password: "secret" }));
    });
    expect(loginAction).toHaveBeenCalledTimes(1);
    const passed = loginAction.mock.calls[0][1] as FormData;
    expect(passed.get("email")).toBe("a@b.com");
    expect(passed.get("password")).toBe("secret");
  });

  it("renders the error alert with the localized message when the action errors", async () => {
    loginAction.mockResolvedValue({ status: "error", code: "ERR_OPERATOR_INVALID_CREDENTIALS" });
    render(<LoginForm />);
    await act(async () => {
      submitLastFormAction(fd({ email: "a@b.com", password: "x" }));
    });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("이메일 또는 비밀번호가 올바르지 않습니다.");
  });
});
