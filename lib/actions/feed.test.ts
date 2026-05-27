import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({
  listAdminFeedPosts: vi.fn(),
  getAdminFeedPost: vi.fn(),
  patchAdminFeedPost: vi.fn(),
  deleteAdminFeedPost: vi.fn(),
}));

import {
  listAdminFeedPosts,
  getAdminFeedPost,
  patchAdminFeedPost,
  deleteAdminFeedPost,
} from "@/lib/adminApi";
import { revalidatePath } from "next/cache";
import {
  listFeedPostsAction,
  getFeedPostAction,
  patchFeedPostAction,
  deleteFeedPostAction,
} from "./feed";

const mockedList = listAdminFeedPosts as unknown as ReturnType<typeof vi.fn>;
const mockedGet = getAdminFeedPost as unknown as ReturnType<typeof vi.fn>;
const mockedPatch = patchAdminFeedPost as unknown as ReturnType<typeof vi.fn>;
const mockedDelete = deleteAdminFeedPost as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidate = revalidatePath as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mockedList.mockReset();
  mockedGet.mockReset();
  mockedPatch.mockReset();
  mockedDelete.mockReset();
  mockedRevalidate.mockReset();
});

describe("feed actions — auth gate", () => {
  it("listFeedPostsAction returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await listFeedPostsAction({});
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toMatch(/세션/);
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("getFeedPostAction returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await getFeedPostAction({ id: "p_1" });
    expect(r.ok).toBe(false);
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("patch/delete also gated", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const p = await patchFeedPostAction({ id: "p_1", is_hidden: true });
    const d = await deleteFeedPostAction({ id: "p_1" });
    expect(p.ok).toBe(false);
    expect(d.ok).toBe(false);
  });
});

describe("feed actions — happy path", () => {
  beforeEach(() => {
    cookieStore.get.mockReturnValue({ value: "j" });
  });

  it("listFeedPostsAction forwards filters + returns data", async () => {
    mockedList.mockResolvedValue({
      ok: true,
      data: { items: [], total: 0, page: 1, page_size: 25 },
    });
    const r = await listFeedPostsAction({
      q: "abc",
      hidden: "true",
      page: 2,
    });
    expect(r.ok).toBe(true);
    expect(mockedList).toHaveBeenCalledWith({
      jwt: "j",
      q: "abc",
      hidden: "true",
      page: 2,
    });
  });

  it("patchFeedPostAction revalidates on success", async () => {
    mockedPatch.mockResolvedValue({
      ok: true,
      data: {
        id: "p_1",
        author_id: "u_1",
        author_handle: null,
        body: "x",
        body_excerpt: "x",
        comments_count: 0,
        is_hidden: true,
        created_at: "2026-05-26T00:00:00Z",
      },
    });
    const r = await patchFeedPostAction({ id: "p_1", is_hidden: true });
    expect(r.ok).toBe(true);
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/feed");
  });

  it("deleteFeedPostAction revalidates on success", async () => {
    mockedDelete.mockResolvedValue({ ok: true, data: { ok: true } });
    const r = await deleteFeedPostAction({ id: "p_1" });
    expect(r.ok).toBe(true);
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/feed");
  });

  it("surfaces server error without revalidating", async () => {
    mockedPatch.mockResolvedValue({
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "down",
      status: 503,
    });
    const r = await patchFeedPostAction({ id: "p_1", body: "new" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("down");
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });
});
