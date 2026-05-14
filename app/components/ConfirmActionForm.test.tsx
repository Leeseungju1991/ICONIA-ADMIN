import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ConfirmActionForm } from "./ConfirmActionForm";

const confirmSpy = vi.fn<(message?: string) => boolean>();
const promptSpy = vi.fn<(message?: string) => string | null>();
const alertSpy = vi.fn<(message?: string) => void>();

beforeEach(() => {
  confirmSpy.mockReset().mockReturnValue(true);
  promptSpy.mockReset().mockReturnValue("valid reason text");
  alertSpy.mockReset();
  vi.stubGlobal("confirm", confirmSpy);
  vi.stubGlobal("prompt", promptSpy);
  vi.stubGlobal("alert", alertSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ConfirmActionForm", () => {
  it("renders the button label", () => {
    render(
      <ConfirmActionForm
        action={vi.fn()}
        confirmMessage="정말 숨기시겠어요?"
        buttonLabel="숨기기"
      />,
    );
    expect(screen.getByRole("button", { name: "숨기기" })).toBeInTheDocument();
  });

  it("does not call the action when confirm is dismissed", () => {
    confirmSpy.mockReturnValue(false);
    const action = vi.fn();
    render(<ConfirmActionForm action={action} confirmMessage="x" buttonLabel="삭제" />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(action).not.toHaveBeenCalled();
  });

  it("does not call the action when the reason prompt is cancelled", () => {
    promptSpy.mockReturnValue(null);
    const action = vi.fn();
    render(<ConfirmActionForm action={action} confirmMessage="x" buttonLabel="삭제" />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(action).not.toHaveBeenCalled();
  });

  it("rejects a reason shorter than 5 chars and alerts", () => {
    promptSpy.mockReturnValue("ok");
    const action = vi.fn();
    render(<ConfirmActionForm action={action} confirmMessage="x" buttonLabel="삭제" />);
    fireEvent.click(screen.getByRole("button", { name: "삭제" }));
    expect(alertSpy).toHaveBeenCalled();
    expect(action).not.toHaveBeenCalled();
  });

  it("calls the action with hidden fields + the typed reason", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmActionForm
        action={action}
        hidden={{ post_id: "p1" }}
        confirmMessage="정말?"
        buttonLabel="숨기기"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "숨기기" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    const fd = action.mock.calls[0][0] as FormData;
    expect(fd.get("post_id")).toBe("p1");
    expect(fd.get("reason")).toBe("valid reason text");
  });

  it("omits the reason field when reasonRequired is false (no prompt)", async () => {
    const action = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmActionForm
        action={action}
        hidden={{ post_id: "p2" }}
        confirmMessage="정말?"
        reasonRequired={false}
        buttonLabel="복원"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "복원" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
    expect(promptSpy).not.toHaveBeenCalled();
    const fd = action.mock.calls[0][0] as FormData;
    expect(fd.get("post_id")).toBe("p2");
    expect(fd.get("reason")).toBeNull();
  });
});
