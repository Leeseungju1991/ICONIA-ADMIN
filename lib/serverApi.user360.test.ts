import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchUser360Snapshot,
  fetchUser360Timeline,
} from "./serverApi.user360";

const ORIG_FETCH = globalThis.fetch;
const ORIG_ENV = process.env.ICONIA_SERVER_URL;

beforeEach(() => {
  process.env.ICONIA_SERVER_URL = "http://server.test";
});
afterEach(() => {
  globalThis.fetch = ORIG_FETCH;
  process.env.ICONIA_SERVER_URL = ORIG_ENV;
});

describe("serverApi.user360", () => {
  it("snapshot ok envelope returns data", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { user: { id: "x" } } }), { status: 200 }));
    const r = await fetchUser360Snapshot("jwt", "usr_1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.user.id).toBe("x");
  });
  it("snapshot 5xx returns ERR_SERVER_UNAVAILABLE", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 503 }));
    const r = await fetchUser360Snapshot("jwt", "usr_1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_SERVER_UNAVAILABLE");
  });
  it("snapshot network fail returns ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("boom"); });
    const r = await fetchUser360Snapshot("jwt", "usr_1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });
  it("snapshot envelope error returns error code", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { code: "ERR_FORBIDDEN", message: "no perm" } }), { status: 403 }));
    const r = await fetchUser360Snapshot("jwt", "usr_1");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_FORBIDDEN");
  });
  it("timeline ok", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { items: [], next_cursor: null } }), { status: 200 }));
    const r = await fetchUser360Timeline("jwt", "usr_1");
    expect(r.ok).toBe(true);
  });
});
