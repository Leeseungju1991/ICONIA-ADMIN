import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// next/headers 모킹 — server action 환경 simulation
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (k: string) => (k === "iconia_admin_jwt" ? { value: "test-jwt" } : undefined) }),
}));

import { fetchUser360Action } from "./user360";

const ORIG_FETCH = globalThis.fetch;
beforeEach(() => { process.env.ICONIA_SERVER_URL = "http://server.test"; });
afterEach(() => { globalThis.fetch = ORIG_FETCH; });

describe("fetchUser360Action", () => {
  it("returns snapshot when Server ok", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true, data: { user: { id: "u1", email: "x@y", account_status: "active", joined_at: "" }, devices: [], server: { active_sessions: 1, refresh_tokens_24h: 0, rate_limit_state: "ok", pipa_consent_version: "v1" }, ai: { persona_name: "A", persona_version: "v", fallback_rate_24h: 0, avg_latency_ms: 0, compression_events_24h: 0 }, app: { app_version: "1", os: "iOS", model: "x", last_push_at: null, last_crash: null } } }), { status: 200 }));
    const r = await fetchUser360Action("u1");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("server");
  });
  it("falls back to mock on ERR_NETWORK", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("boom"); });
    const r = await fetchUser360Action("demo@iconia.example");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("mock");
  });
  it("falls back to mock on ERR_SERVER_UNAVAILABLE", async () => {
    globalThis.fetch = vi.fn(async () => new Response("err", { status: 503 }));
    const r = await fetchUser360Action("demo@iconia.example");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.source).toBe("mock");
  });
  it("returns ok=false on envelope auth error", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ ok: false, error: { code: "ERR_FORBIDDEN", message: "no perm" } }), { status: 403 }));
    const r = await fetchUser360Action("u1");
    expect(r.ok).toBe(false);
  });
});
