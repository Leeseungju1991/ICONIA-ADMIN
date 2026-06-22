import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchCommunityFeed,
  fetchCommunityPost,
  fetchCommunityHealth,
  hideCommunityPost,
  unhideCommunityPost,
  takedownCommunityPost,
  hidePostsByAuthor,
} from "./serverApi.community";

type FetchFn = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
const mockFetch = (impl: FetchFn) => vi.fn<FetchFn>(impl);

const ORIG_FETCH = globalThis.fetch;
const ORIG_ENV = process.env.ICONIA_SERVER_URL;

beforeEach(() => {
  process.env.ICONIA_SERVER_URL = "http://server.test";
});
afterEach(() => {
  globalThis.fetch = ORIG_FETCH;
  process.env.ICONIA_SERVER_URL = ORIG_ENV;
});

describe("serverApi.community — fetchCommunityFeed", () => {
  it("ok envelope returns data", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, data: { items: [], next_cursor: null } }),
          { status: 200 },
        ),
    );
    const r = await fetchCommunityFeed("jwt", "latest");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.items).toEqual([]);
  });
  it("5xx returns ERR_SERVER_UNAVAILABLE", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 503 }));
    const r = await fetchCommunityFeed("jwt", "latest");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });
  it("network fail returns ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await fetchCommunityFeed("jwt", "latest");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });
  it("envelope error returns error code", async () => {
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
    const r = await fetchCommunityFeed("jwt", "latest");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_FORBIDDEN");
  });
});

describe("serverApi.community — fetchCommunityPost", () => {
  it("ok envelope returns data", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ ok: true, data: { id: "post_0001" } }),
          { status: 200 },
        ),
    );
    const r = await fetchCommunityPost("jwt", "post_0001");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.id).toBe("post_0001");
  });
  it("5xx returns ERR_SERVER_UNAVAILABLE", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 500 }));
    const r = await fetchCommunityPost("jwt", "post_0001");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });
  it("network fail returns ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await fetchCommunityPost("jwt", "post_0001");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });
  it("envelope error returns error code", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "ERR_NOT_FOUND", message: "missing" },
          }),
          { status: 404 },
        ),
    );
    const r = await fetchCommunityPost("jwt", "post_0001");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NOT_FOUND");
  });
});

describe("serverApi.community — fetchCommunityHealth", () => {
  it("ok envelope returns data", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: true,
            data: {
              posts_24h: 1,
              active_authors_dau: 2,
              reports_pending: 3,
              takedowns_7d: 4,
            },
          }),
          { status: 200 },
        ),
    );
    const r = await fetchCommunityHealth("jwt");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.posts_24h).toBe(1);
  });
  it("5xx returns ERR_SERVER_UNAVAILABLE", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 502 }));
    const r = await fetchCommunityHealth("jwt");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });
  it("network fail returns ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await fetchCommunityHealth("jwt");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });
  it("envelope error returns error code", async () => {
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
    const r = await fetchCommunityHealth("jwt");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_FORBIDDEN");
  });
});

describe("serverApi.community — hideCommunityPost", () => {
  it("ok envelope returns data and sends POST body", async () => {
    const fetchMock = mockFetch(
      async () =>
        new Response(
          JSON.stringify({ ok: true, data: { status: "hidden" } }),
          { status: 200 },
        ),
    );
    globalThis.fetch = fetchMock;
    const r = await hideCommunityPost("jwt", "post_0001", "spam");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("hidden");
    const call = fetchMock.mock.calls[0];
    expect(call[1]?.method).toBe("POST");
    expect(call[1]?.body).toBe(JSON.stringify({ reason: "spam" }));
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });
  it("5xx returns ERR_SERVER_UNAVAILABLE", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 503 }));
    const r = await hideCommunityPost("jwt", "post_0001", "spam");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });
  it("network fail returns ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await hideCommunityPost("jwt", "post_0001", "spam");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });
  it("envelope error returns error code", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "ERR_CONFLICT", message: "already hidden" },
          }),
          { status: 409 },
        ),
    );
    const r = await hideCommunityPost("jwt", "post_0001", "spam");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_CONFLICT");
  });
});

describe("serverApi.community — unhideCommunityPost", () => {
  it("ok envelope returns data and POST with no body", async () => {
    const fetchMock = mockFetch(
      async () =>
        new Response(
          JSON.stringify({ ok: true, data: { status: "visible" } }),
          { status: 200 },
        ),
    );
    globalThis.fetch = fetchMock;
    const r = await unhideCommunityPost("jwt", "post_0001");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("visible");
    const call = fetchMock.mock.calls[0];
    expect(call[1]?.method).toBe("POST");
    expect(call[1]?.body).toBeUndefined();
  });
  it("5xx returns ERR_SERVER_UNAVAILABLE", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 504 }));
    const r = await unhideCommunityPost("jwt", "post_0001");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });
  it("network fail returns ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await unhideCommunityPost("jwt", "post_0001");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });
  it("envelope error returns error code", async () => {
    globalThis.fetch = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error: { code: "ERR_NOT_FOUND", message: "post missing" },
          }),
          { status: 404 },
        ),
    );
    const r = await unhideCommunityPost("jwt", "post_0001");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NOT_FOUND");
  });
});

describe("serverApi.community — takedownCommunityPost", () => {
  it("ok envelope returns data and sends POST body", async () => {
    const fetchMock = mockFetch(
      async () =>
        new Response(
          JSON.stringify({ ok: true, data: { status: "taken_down" } }),
          { status: 200 },
        ),
    );
    globalThis.fetch = fetchMock;
    const r = await takedownCommunityPost("jwt", "post_0001", "harmful");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.status).toBe("taken_down");
    const call = fetchMock.mock.calls[0];
    expect(call[1]?.method).toBe("POST");
    expect(call[1]?.body).toBe(JSON.stringify({ reason: "harmful" }));
  });
  it("5xx returns ERR_SERVER_UNAVAILABLE", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 503 }));
    const r = await takedownCommunityPost("jwt", "post_0001", "harmful");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });
  it("network fail returns ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("boom");
    });
    const r = await takedownCommunityPost("jwt", "post_0001", "harmful");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });
  it("envelope error returns error code", async () => {
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
    const r = await takedownCommunityPost("jwt", "post_0001", "harmful");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_FORBIDDEN");
  });
});

describe("serverApi.community — hidePostsByAuthor (stub: ERR_NOT_IMPLEMENTED)", () => {
  // 2026-06-22 — hidePostsByAuthor 는 서버 측 bulk takedown 미배포 상태로 stub 만 존재
  //   (lib/serverApi.community.ts:126-149). 실제 fetch 호출 없이 즉시 ERR_NOT_IMPLEMENTED 반환.
  //   서버 배선 완료 후 본 4개 케이스(ok envelope / 5xx / network / 429)를 부활시킨다.
  it("stub always returns ERR_NOT_IMPLEMENTED", async () => {
    const r = await hidePostsByAuthor("jwt", "usr_42", "abuse");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NOT_IMPLEMENTED");
  });
});
