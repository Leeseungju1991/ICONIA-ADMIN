import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/adminApi", () => ({ getAiHealth: vi.fn() }));

import { getAiHealth, type AiHealthSnapshot } from "@/lib/adminApi";
import { getAiHealthAction } from "./aiHealth";

const mockedGetAiHealth = getAiHealth as unknown as ReturnType<typeof vi.fn>;

const SNAPSHOT: AiHealthSnapshot = {
  window_ms: 300000,
  window_total: 120,
  fallback_count: 6,
  fallback_rate: 0.05,
  fallback_breakdown: { timeout: 4, quota: 2 },
  error_count: 3,
  error_rate: 0.025,
  latency_ms: { p50: 800, p95: 2400, p99: 3100, max: 5200 },
  prompt_tokens_total: 48000,
  completion_tokens_total: 21000,
  calls_last_minute: 22,
  by_model: [
    {
      model: "gemini-2.0-flash",
      calls: 120,
      fallback_count: 6,
      prompt_tokens: 48000,
      completion_tokens: 21000,
      avg_latency_ms: 940,
    },
  ],
};

beforeEach(() => {
  cookieStore.get.mockReset();
  mockedGetAiHealth.mockReset();
});

describe("getAiHealthAction", () => {
  it("returns session-expired when no cookie is present", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await getAiHealthAction();
    expect(r.ok).toBe(false);
    expect(mockedGetAiHealth).not.toHaveBeenCalled();
  });

  it("returns the snapshot on success and reads jwt from the httpOnly cookie", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-abc" });
    mockedGetAiHealth.mockResolvedValue({ ok: true, data: SNAPSHOT });
    const r = await getAiHealthAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.snapshot).toEqual(SNAPSHOT);
    expect(mockedGetAiHealth).toHaveBeenCalledWith({ jwt: "jwt-abc" });
  });

  it("surfaces an API error with a human message (graceful degrade signal)", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-abc" });
    mockedGetAiHealth.mockResolvedValue({
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "server_unavailable",
      status: 503,
    });
    const r = await getAiHealthAction();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_SERVER_UNAVAILABLE");
  });
});
