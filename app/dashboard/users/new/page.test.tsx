import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

// 1) Mock server action BEFORE importing page.
vi.mock("@/lib/actions/adminUserCreate", () => ({
  createAdminUserAction: vi.fn(),
}));

// 2) Mock next/navigation (router + searchParams).
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

import { createAdminUserAction } from "@/lib/actions/adminUserCreate";
import NewUserPage from "./page";

const mAction = createAdminUserAction as unknown as ReturnType<typeof vi.fn>;

afterEach(cleanup);
beforeEach(() => {
  mAction.mockReset();
  pushMock.mockReset();
});

function fillRequired() {
  fireEvent.change(screen.getByPlaceholderText("user@example.com"), {
    target: { value: "alice@example.com" },
  });
  const pw = screen.getAllByDisplayValue("");
  // First password input
  const pwInputs = document.querySelectorAll<HTMLInputElement>(
    'input[type="password"], input[autocomplete="new-password"]',
  );
  fireEvent.change(pwInputs[0], { target: { value: "StrongPass123!" } });
  fireEvent.change(pwInputs[1], { target: { value: "StrongPass123!" } });

  // 사유 textarea
  const reasonTa = screen
    .getAllByRole("textbox")
    .find((el) => el.tagName === "TEXTAREA");
  if (reasonTa) {
    fireEvent.change(reasonTa, { target: { value: "운영팀 수동 가입 — 영업 시연" } });
  }
}

describe("NewUserPage — render & validation", () => {
  it("renders all required fields", () => {
    render(<NewUserPage />);
    expect(screen.getByText("사용자 추가")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
    expect(screen.getByText(/사용자 대신 4종 약관/)).toBeInTheDocument();
    expect(screen.getByText(/19세 이상 본인 확인/)).toBeInTheDocument();
  });

  it("blocks submit when terms checkbox unchecked", () => {
    render(<NewUserPage />);
    fillRequired();
    // ageVerified 체크박스만 체크. terms 는 비움.
    const checkboxes = screen.getAllByRole("checkbox");
    // 3개: terms, ageVerified, autoVerify(기본 on)
    fireEvent.click(checkboxes[1]); // ageVerified
    const submit = screen.getByRole("button", { name: /사용자 생성/ });
    fireEvent.click(submit);
    expect(screen.getByText(/약관 4종 대리 동의가 필요합니다/)).toBeInTheDocument();
    expect(mAction).not.toHaveBeenCalled();
  });

  it("blocks submit when ageVerified unchecked", () => {
    render(<NewUserPage />);
    fillRequired();
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // terms only
    const submit = screen.getByRole("button", { name: /사용자 생성/ });
    fireEvent.click(submit);
    expect(screen.getByText(/19세 이상 본인 확인이 필요합니다/)).toBeInTheDocument();
    expect(mAction).not.toHaveBeenCalled();
  });

  it("shows confirmation modal when valid", () => {
    render(<NewUserPage />);
    fillRequired();
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]); // terms
    fireEvent.click(checkboxes[1]); // ageVerified
    const submit = screen.getByRole("button", { name: /사용자 생성/ });
    fireEvent.click(submit);
    expect(screen.getByText("사용자 추가 확정")).toBeInTheDocument();
  });
});

describe("NewUserPage — submission & error mapping", () => {
  it("calls action and redirects on success", async () => {
    mAction.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "uuid-1",
          email: "alice@example.com",
          role: "user",
          account_status: "active",
          created_at: "2026-05-27T00:00:00Z",
          is_verified: true,
        },
      },
    });
    render(<NewUserPage />);
    fillRequired();
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: /사용자 생성/ }));
    // confirmation
    expect(screen.getByText("사용자 추가 확정")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /확정 — 사용자 추가/ }));
    await waitFor(() => {
      expect(mAction).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(expect.stringContaining("created=uuid-1"));
    });
  });

  it("maps ERR_USER_EMAIL_EXISTS to 한글 이메일 중복 안내", async () => {
    mAction.mockResolvedValue({
      ok: false,
      code: "ERR_USER_EMAIL_EXISTS",
      message: "email_already_in_use",
    });
    render(<NewUserPage />);
    fillRequired();
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: /사용자 생성/ }));
    fireEvent.click(screen.getByRole("button", { name: /확정 — 사용자 추가/ }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("이미 사용 중인 이메일");
    });
  });

  it("shows graceful '준비 중' on ERR_SERVER_UNAVAILABLE without losing input", async () => {
    mAction.mockResolvedValue({
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "server_unavailable",
    });
    render(<NewUserPage />);
    fillRequired();
    const checkboxes = screen.getAllByRole("checkbox");
    fireEvent.click(checkboxes[0]);
    fireEvent.click(checkboxes[1]);
    fireEvent.click(screen.getByRole("button", { name: /사용자 생성/ }));
    fireEvent.click(screen.getByRole("button", { name: /확정 — 사용자 추가/ }));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("준비 중");
    });
    // 입력값 보존 — 이메일 그대로.
    expect((screen.getByPlaceholderText("user@example.com") as HTMLInputElement).value).toBe(
      "alice@example.com",
    );
  });
});

describe("NewUserPage — password strength indicator", () => {
  it("shows 'weak' for short password", () => {
    render(<NewUserPage />);
    const pwInputs = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]',
    );
    fireEvent.change(pwInputs[0], { target: { value: "abc" } });
    expect(screen.getByTestId("pw-strength-label").textContent).toBe("약함");
  });

  it("shows 'strong' for long+varied password", () => {
    render(<NewUserPage />);
    const pwInputs = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]',
    );
    fireEvent.change(pwInputs[0], { target: { value: "MyStrongPass#2026" } });
    expect(screen.getByTestId("pw-strength-label").textContent).toBe("강함");
  });
});
