import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({
  hidePost: vi.fn(),
  unhidePost: vi.fn(),
}));

import { hidePost, unhidePost } from "@/lib/adminApi";
import { revalidatePath } from "next/cache";
import { hidePostAction, unhidePostAction } from "./posts";

const mockedHide = hidePost as unknown as ReturnType<typeof vi.fn>;
const mockedUnhide = unhidePost as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidate = revalidatePath as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mockedHide.mockReset();
  mockedUnhide.mockReset();
  mockedRevalidate.mockReset();
});

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

describe("hidePostAction", () => {
  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await hidePostAction(fd({ post_id: "p1", reason: "spam" }));
    expect(r.ok).toBe(false);
    expect(mockedHide).not.toHaveBeenCalled();
  });

  it("returns error when post_id or reason missing", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await hidePostAction(fd({ post_id: "p1" }));
    expect(r.ok).toBe(false);
    expect(mockedHide).not.toHaveBeenCalled();
  });

  it("calls hidePost + revalidates posts page on success", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedHide.mockResolvedValue({ ok: true, data: { ok: true } });
    const r = await hidePostAction(fd({ post_id: "p1", reason: "abuse report" }));
    expect(r).toEqual({ ok: true });
    expect(mockedHide).toHaveBeenCalledWith({ jwt: "j", postId: "p1", reason: "abuse report" });
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/posts");
  });

  it("surfaces API error and does not revalidate", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedHide.mockResolvedValue({ ok: false, code: "ERR_POST_NOT_FOUND", message: "nope", status: 404 });
    const r = await hidePostAction(fd({ post_id: "p1", reason: "abuse report" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_POST_NOT_FOUND");
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });
});

describe("unhidePostAction", () => {
  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await unhidePostAction(fd({ post_id: "p1" }));
    expect(r.ok).toBe(false);
    expect(mockedUnhide).not.toHaveBeenCalled();
  });

  it("returns error when post_id missing", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await unhidePostAction(fd({}));
    expect(r.ok).toBe(false);
    expect(mockedUnhide).not.toHaveBeenCalled();
  });

  it("calls unhidePost + revalidates posts page on success", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedUnhide.mockResolvedValue({ ok: true, data: { ok: true } });
    const r = await unhidePostAction(fd({ post_id: "p2" }));
    expect(r).toEqual({ ok: true });
    expect(mockedUnhide).toHaveBeenCalledWith({ jwt: "j", postId: "p2" });
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/posts");
  });

  it("surfaces API error", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedUnhide.mockResolvedValue({ ok: false, code: "ERR_OPERATOR_AUTH_EXPIRED", message: "expired", status: 401 });
    const r = await unhidePostAction(fd({ post_id: "p2" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_OPERATOR_AUTH_EXPIRED");
  });
});
