import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";

// Mock server action.
vi.mock("@/lib/actions/adminFeedPostCreate", () => ({
  createAdminFeedPostAction: vi.fn(),
}));

// Mock next/navigation.
const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

import { createAdminFeedPostAction } from "@/lib/actions/adminFeedPostCreate";
import NewFeedPostPage from "./page";

const mAction = createAdminFeedPostAction as unknown as ReturnType<typeof vi.fn>;

// URL.createObjectURL is not available in jsdom — polyfill.
beforeEach(() => {
  if (!URL.createObjectURL) {
    (URL as unknown as { createObjectURL: (b: Blob) => string }).createObjectURL =
      vi.fn(() => "blob:mock");
  }
  if (!URL.revokeObjectURL) {
    (URL as unknown as { revokeObjectURL: (u: string) => void }).revokeObjectURL =
      vi.fn();
  }
  mAction.mockReset();
  pushMock.mockReset();
});
afterEach(cleanup);

const VALID_UUID = "00000000-0000-0000-0000-000000000001";

function fillBasic() {
  const authorInput = screen.getByPlaceholderText(/00000000-0000/);
  fireEvent.change(authorInput, { target: { value: VALID_UUID } });
  const bodyTa = screen.getByPlaceholderText(/피드 본문을 입력/);
  fireEvent.change(bodyTa, { target: { value: "운영팀이 작성한 본문" } });
  const reasonTa = screen.getByPlaceholderText(/공식 공지 안내/);
  fireEvent.change(reasonTa, { target: { value: "운영팀 공식 안내 게시" } });
}

describe("NewFeedPostPage — render & validation", () => {
  it("renders form fields and dropzone", () => {
    render(<NewFeedPostPage />);
    expect(screen.getByText("새 피드 게시물")).toBeInTheDocument();
    expect(screen.getByTestId("media-dropzone")).toBeInTheDocument();
    expect(screen.getByText(/이곳에 끌어다 놓거나 클릭하여 선택/)).toBeInTheDocument();
  });

  it("blocks submit when author UUID invalid", () => {
    render(<NewFeedPostPage />);
    const authorInput = screen.getByPlaceholderText(/00000000-0000/);
    fireEvent.change(authorInput, { target: { value: "not-a-uuid" } });
    const bodyTa = screen.getByPlaceholderText(/피드 본문을 입력/);
    fireEvent.change(bodyTa, { target: { value: "본문" } });
    const reasonTa = screen.getByPlaceholderText(/공식 공지 안내/);
    fireEvent.change(reasonTa, { target: { value: "사유 5자 이상" } });
    fireEvent.click(screen.getByTestId("submit-post"));
    expect(screen.getByText(/UUID 형식이 아닙니다/)).toBeInTheDocument();
    expect(mAction).not.toHaveBeenCalled();
  });

  it("blocks submit when reason < 5 chars", () => {
    render(<NewFeedPostPage />);
    const authorInput = screen.getByPlaceholderText(/00000000-0000/);
    fireEvent.change(authorInput, { target: { value: VALID_UUID } });
    const bodyTa = screen.getByPlaceholderText(/피드 본문을 입력/);
    fireEvent.change(bodyTa, { target: { value: "본문" } });
    const reasonTa = screen.getByPlaceholderText(/공식 공지 안내/);
    fireEvent.change(reasonTa, { target: { value: "짧음" } });
    fireEvent.click(screen.getByTestId("submit-post"));
    expect(screen.getByText(/사유는 5자 이상/)).toBeInTheDocument();
    expect(mAction).not.toHaveBeenCalled();
  });
});

describe("NewFeedPostPage — submission", () => {
  it("calls action with media=[] when no upload", async () => {
    mAction.mockResolvedValue({
      ok: true,
      data: {
        post: {
          id: "p_new_1",
          author_id: VALID_UUID,
          body: "운영팀이 작성한 본문",
          comments_count: 0,
          is_hidden: false,
          created_at: "2026-05-27T00:00:00Z",
        },
        mediaCount: 0,
      },
    });
    render(<NewFeedPostPage />);
    fillBasic();
    fireEvent.click(screen.getByTestId("submit-post"));
    await waitFor(() => {
      expect(mAction).toHaveBeenCalledTimes(1);
    });
    const call = mAction.mock.calls[0][0] as {
      authorId: string;
      media: unknown[];
    };
    expect(call.authorId).toBe(VALID_UUID);
    expect(call.media).toEqual([]);
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(
        expect.stringContaining("created=p_new_1"),
      );
    });
  });

  it("shows graceful '준비 중' on ERR_NETWORK", async () => {
    mAction.mockResolvedValue({
      ok: false,
      code: "ERR_NETWORK",
      message: "network_error",
    });
    render(<NewFeedPostPage />);
    fillBasic();
    fireEvent.click(screen.getByTestId("submit-post"));
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toContain("준비 중");
    });
    // 본문 보존
    expect(
      (screen.getByPlaceholderText(/피드 본문을 입력/) as HTMLTextAreaElement).value,
    ).toBe("운영팀이 작성한 본문");
  });

  it("rejects file with disallowed type via local validation", async () => {
    render(<NewFeedPostPage />);
    fillBasic();
    // 파일 선택 — disallowed type (text/plain).
    const dz = screen.getByTestId("media-dropzone");
    const file = new File(["hello"], "x.txt", { type: "text/plain" });
    const fileInput = dz.querySelector<HTMLInputElement>('input[type="file"]')!;
    Object.defineProperty(fileInput, "files", {
      value: [file],
      writable: false,
    });
    fireEvent.change(fileInput);
    // disallowed file 은 media list 에 error 상태로 추가됨 — preview card 의 짧은 에러 텍스트.
    await waitFor(() => {
      // 미디어 preview card 의 에러 메시지에서 "허용되지 않는 형식" 으로 시작.
      const errorTexts = screen.getAllByText(/허용되지 않는 형식/);
      expect(errorTexts.length).toBeGreaterThan(0);
    });
  });

  it("enforces body length limit (4000)", () => {
    render(<NewFeedPostPage />);
    const authorInput = screen.getByPlaceholderText(/00000000-0000/);
    fireEvent.change(authorInput, { target: { value: VALID_UUID } });
    const bodyTa = screen.getByPlaceholderText(/피드 본문을 입력/) as HTMLTextAreaElement;
    // maxLength HTML attr 가 4000 으로 클립한다 — 한계 직전까지 입력해도 통과해야 한다.
    expect(bodyTa.maxLength).toBe(4000);
  });
});
