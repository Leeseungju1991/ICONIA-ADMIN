import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next/headers", () => ({
  cookies: () => ({
    get: (k: string) => (k === "iconia_admin_jwt" ? { value: "test-jwt" } : undefined),
  }),
}));

import {
  listFeedAction,
  getPostDetailAction,
  getCommunityHealthAction,
  hidePostAction,
  unhidePostAction,
  takedownPostAction,
} from "./community";

const ORIG_FETCH = globalThis.fetch;
const ORIG_ENV = process.env.ICONIA_SERVER_URL;

beforeEach(() => {
  process.env.ICONIA_SERVER_URL = "http://server.test";
});
afterEach(() => {
  globalThis.fetch = ORIG_FETCH;
  process.env.ICONIA_SERVER_URL = ORIG_ENV;
});

// ---------- listFeedAction ----------
describe("listFeedAction", () => {
  it("returns server items when ok", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              items: [
                {
                  id: "p1",
                  author_id: "a1",
                  author_name: "n",
                  excerpt: "e",
                  media_thumb: null,
                  created_at: "",
                  like_count: 1,
                  comment_count: 0,
                  report_count: 0,
                  status: "visible",
                },
              ],
              next_cursor: "c2",
            },
          }),
          { status: 200 },
        ),
    );
    const r = await listFeedAction("latest");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("server");
      expect(r.items.length).toBe(1);
      expect(r.next_cursor).toBe("c2");
    }
  });

  it("falls back to mock on ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await listFeedAction("popular");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("mock");
      expect(r.items.length).toBeGreaterThan(0);
    }
  });

  it("falls back to mock on ERR_SERVER_UNAVAILABLE (503)", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 503 }));
    const r = await listFeedAction("reported");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("mock");
  });

  it("returns ok=false on envelope error", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "ERR_FORBIDDEN", message: "no perm" },
          }),
          { status: 403 },
        ),
    );
    const r = await listFeedAction("latest");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_FORBIDDEN");
  });
});

// ---------- getPostDetailAction ----------
describe("getPostDetailAction", () => {
  it("returns post when server ok", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              id: "p1",
              author_id: "a1",
              author_name: "n",
              excerpt: "e",
              media_thumb: null,
              created_at: "",
              like_count: 1,
              comment_count: 0,
              report_count: 0,
              status: "visible",
              body: "b",
              media: [],
              comments: [],
              reports: [],
            },
          }),
          { status: 200 },
        ),
    );
    const r = await getPostDetailAction("p1");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("server");
      expect(r.post.id).toBe("p1");
    }
  });

  it("falls back to mock on ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await getPostDetailAction("post_0000");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("mock");
  });

  it("falls back to mock on 503", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 503 }));
    const r = await getPostDetailAction("post_0000");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("mock");
  });

  it("returns ok=false on envelope error", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "ERR_NOT_FOUND", message: "nope" },
          }),
          { status: 404 },
        ),
    );
    const r = await getPostDetailAction("p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NOT_FOUND");
  });
});

// ---------- getCommunityHealthAction ----------
describe("getCommunityHealthAction", () => {
  it("returns health when server ok", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              posts_24h: 10,
              active_authors_dau: 5,
              reports_pending: 2,
              takedowns_7d: 1,
            },
          }),
          { status: 200 },
        ),
    );
    const r = await getCommunityHealthAction();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("server");
      expect(r.health.posts_24h).toBe(10);
    }
  });

  it("falls back to mock on ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await getCommunityHealthAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("mock");
  });

  it("falls back to mock on 503", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 503 }));
    const r = await getCommunityHealthAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("mock");
  });

  it("returns ok=false on envelope error", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "ERR_FORBIDDEN", message: "no perm" },
          }),
          { status: 403 },
        ),
    );
    const r = await getCommunityHealthAction();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_FORBIDDEN");
  });
});

// ---------- hidePostAction ----------
describe("hidePostAction", () => {
  it("succeeds when server ok", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, data: { status: "hidden" } }), { status: 200 }),
    );
    const r = await hidePostAction("p1", "violates_rules");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("hidden");
  });

  it("rejects reason shorter than 5 chars (guard)", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const r = await hidePostAction("p1", "bad");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_REASON_TOO_SHORT");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects whitespace-only reason (trim guard)", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const r = await hidePostAction("p1", "    ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_REASON_TOO_SHORT");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("surfaces envelope error", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "ERR_FORBIDDEN", message: "no perm" },
          }),
          { status: 403 },
        ),
    );
    const r = await hidePostAction("p1", "good reason here");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_FORBIDDEN");
  });
});

// ---------- unhidePostAction ----------
describe("unhidePostAction", () => {
  it("succeeds when server ok", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, data: { status: "visible" } }), { status: 200 }),
    );
    const r = await unhidePostAction("p1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("visible");
  });

  it("returns ERR_NETWORK when fetch fails (no mock fallback for mutation)", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await unhidePostAction("p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });

  it("returns ERR_SERVER_UNAVAILABLE on 503", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 503 }));
    const r = await unhidePostAction("p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });

  it("surfaces envelope error", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "ERR_FORBIDDEN", message: "no perm" },
          }),
          { status: 403 },
        ),
    );
    const r = await unhidePostAction("p1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_FORBIDDEN");
  });
});

// ---------- takedownPostAction ----------
describe("takedownPostAction", () => {
  it("succeeds when server ok", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(JSON.stringify({ ok: true, data: { status: "taken_down" } }), {
          status: 200,
        }),
    );
    const r = await takedownPostAction("p1", "violates_tos_explicit");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("taken_down");
  });

  it("rejects short reason (guard)", async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    const r = await takedownPostAction("p1", "no");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_REASON_TOO_SHORT");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns ERR_NETWORK when fetch fails", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await takedownPostAction("p1", "good enough reason");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });

  it("surfaces envelope error", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "ERR_FORBIDDEN", message: "no perm" },
          }),
          { status: 403 },
        ),
    );
    const r = await takedownPostAction("p1", "good enough reason");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_FORBIDDEN");
  });
});
