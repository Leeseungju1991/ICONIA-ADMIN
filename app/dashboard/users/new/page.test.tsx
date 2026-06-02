import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

// 2026-06-02 R-J — 본 테스트는 출시 정합 라운드에서 갱신됨.
// 과거에는 멀티 체크박스(terms / ageVerified / autoVerify) + 사유 textarea + 확정 모달 + 비밀번호 강도
// 컴포넌트 기반의 복잡한 UI 를 검증했으나, 라운드 14 (수동 사용자 추가 단순화 R14) 에서 페이지가
// 이메일·비밀번호·UUID 3개 입력만 남기고 약관/19+/사유는 운영자 책임 하에 자동 적용되도록 정리됐다.
// (page.tsx 상단 주석 참조). 본 테스트는 단순화된 정식 동작을 검증한다.

vi.mock("@/lib/actions/adminUserCreate", () => ({
  createAdminUserAction: vi.fn(),
}));

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

function setEmail(value: string) {
  fireEvent.change(screen.getByPlaceholderText("user@example.com"), {
    target: { value },
  });
}

function setPassword(value: string) {
  const pwInputs = document.querySelectorAll<HTMLInputElement>(
    'input[autocomplete="new-password"]',
  );
  fireEvent.change(pwInputs[0], { target: { value } });
}

function clickSubmit() {
  // 단순화된 폼 — submit 이벤트를 폼에 직접 dispatch 한다. jsdom 의 native email/required 검증을
  // 우회하고 컴포넌트의 onSubmit handler(clientValidate → setError) 가 항상 실행되도록 강제.
  const form = document.querySelector("form") as HTMLFormElement;
  fireEvent.submit(form);
}

describe("NewUserPage — render & validation", () => {
  it("renders required fields (email, password, uuid)", () => {
    render(<NewUserPage />);
    // 패널 제목 + submit 버튼 양쪽 모두 "사용자 추가" 텍스트 — getAllByText 로 모호성 회피.
    expect(screen.getAllByText("사용자 추가").length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("user@example.com")).toBeInTheDocument();
    // 자동 적용 안내 박스가 약관/19+/검증/사유 4종을 모두 명시한다.
    expect(screen.getByText(/약관 v/)).toBeInTheDocument();
    expect(
      screen.getByText(/19세 이상 본인 확인 — 운영자 책임/),
    ).toBeInTheDocument();
  });

  it("blocks submit when email missing", () => {
    render(<NewUserPage />);
    setPassword("StrongPass123!");
    clickSubmit();
    expect(screen.getByText(/이메일을 입력하세요/)).toBeInTheDocument();
    expect(mAction).not.toHaveBeenCalled();
  });

  it("blocks submit when password missing", () => {
    render(<NewUserPage />);
    setEmail("alice@example.com");
    clickSubmit();
    expect(screen.getByText(/비밀번호를 입력하세요/)).toBeInTheDocument();
    expect(mAction).not.toHaveBeenCalled();
  });

  it("rejects invalid email format", () => {
    render(<NewUserPage />);
    setEmail("not-an-email");
    setPassword("StrongPass123!");
    clickSubmit();
    expect(
      screen.getByText(/이메일 형식이 올바르지 않습니다/),
    ).toBeInTheDocument();
    expect(mAction).not.toHaveBeenCalled();
  });

  it("rejects password shorter than 8 chars", () => {
    render(<NewUserPage />);
    setEmail("alice@example.com");
    setPassword("short");
    clickSubmit();
    expect(
      screen.getByText(/비밀번호는 8자 이상이어야 합니다/),
    ).toBeInTheDocument();
    expect(mAction).not.toHaveBeenCalled();
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
          created_at: "2026-06-02T00:00:00Z",
          is_verified: true,
        },
      },
    });
    render(<NewUserPage />);
    setEmail("alice@example.com");
    setPassword("StrongPass123!");
    clickSubmit();
    await waitFor(() => {
      expect(mAction).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        expect.stringContaining("created=uuid-1"),
      );
    });
    // 운영자 책임 자동 적용 — agreedTermsVersion=1.0, ageVerified=true, reason=admin_manual_create.
    const args = mAction.mock.calls[0][0];
    expect(args.email).toBe("alice@example.com");
    expect(args.ageVerified).toBe(true);
    expect(args.agreedTermsVersion).toBe("1.0");
    expect(args.reason).toBe("admin_manual_create");
  });

  it("maps ERR_USER_EMAIL_EXISTS to 한글 이메일 중복 안내", async () => {
    mAction.mockResolvedValue({
      ok: false,
      code: "ERR_USER_EMAIL_EXISTS",
      message: "email_already_in_use",
    });
    render(<NewUserPage />);
    setEmail("alice@example.com");
    setPassword("StrongPass123!");
    clickSubmit();
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "이미 사용 중인 이메일",
      );
    });
  });

  it("shows graceful '준비 중' on ERR_SERVER_UNAVAILABLE without losing input", async () => {
    mAction.mockResolvedValue({
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "server_unavailable",
    });
    render(<NewUserPage />);
    setEmail("alice@example.com");
    setPassword("StrongPass123!");
    clickSubmit();
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("준비 중");
    });
    // 입력값 보존 — 이메일 그대로.
    expect(
      (screen.getByPlaceholderText("user@example.com") as HTMLInputElement).value,
    ).toBe("alice@example.com");
  });

  it("maps ERR_USER_ID_EXISTS when explicit UUID conflicts", async () => {
    mAction.mockResolvedValue({
      ok: false,
      code: "ERR_USER_ID_EXISTS",
      message: "uuid_already_in_use",
    });
    render(<NewUserPage />);
    setEmail("alice@example.com");
    setPassword("StrongPass123!");
    // UUID 입력 (3번째 텍스트 input).
    const uuidInput = screen.getByPlaceholderText(/자동 생성/);
    fireEvent.change(uuidInput, {
      target: { value: "11111111-2222-3333-4444-555555555555" },
    });
    clickSubmit();
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain(
        "이미 사용 중인 UUID",
      );
    });
  });
});

describe("NewUserPage — UUID validation", () => {
  it("rejects malformed UUID input (8-4-4-4-12 hex)", () => {
    render(<NewUserPage />);
    setEmail("alice@example.com");
    setPassword("StrongPass123!");
    const uuidInput = screen.getByPlaceholderText(/자동 생성/);
    fireEvent.change(uuidInput, { target: { value: "not-a-uuid" } });
    clickSubmit();
    expect(
      screen.getByText(/UUID 형식이 올바르지 않습니다/),
    ).toBeInTheDocument();
    expect(mAction).not.toHaveBeenCalled();
  });

  it("accepts blank UUID (server auto-generates)", async () => {
    mAction.mockResolvedValue({
      ok: true,
      data: {
        user: {
          id: "auto-uuid",
          email: "bob@example.com",
          role: "user",
          account_status: "active",
          created_at: "2026-06-02T00:00:00Z",
          is_verified: true,
        },
      },
    });
    render(<NewUserPage />);
    setEmail("bob@example.com");
    setPassword("AnotherPass456!");
    clickSubmit();
    await waitFor(() => {
      expect(mAction).toHaveBeenCalledTimes(1);
    });
    const args = mAction.mock.calls[0][0];
    expect(args.id).toBeUndefined();
  });
});
