import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("@/lib/adminApi", () => ({
  getSloSnapshot: vi.fn(),
}));

import { getSloSnapshot } from "@/lib/adminApi";
import { getSloSnapshotAction } from "./slo";

const mSnap = getSloSnapshot as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mSnap.mockReset();
});

describe("slo actions", () => {
  it("getSloSnapshotAction requires session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await getSloSnapshotAction();
    expect(r.ok).toBe(false);
    expect(mSnap).not.toHaveBeenCalled();
  });

  it("getSloSnapshotAction returns server snapshot", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mSnap.mockResolvedValue({
      ok: true,
      data: {
        window_ms: 300_000,
        observed_at: "2026-05-27T00:00:00Z",
        overall: {
          calls: 1234,
          p50: 12,
          p95: 80,
          p99: 200,
          error_rate: 0.001,
          client_error_rate: 0.02,
        },
        by_route: [],
        ai: {
          fallback_rate: 0.01,
          error_rate: 0,
          p95_latency_ms: 1200,
          calls_last_minute: 30,
        },
        dependencies: [],
      },
    });
    const r = await getSloSnapshotAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.overall.calls).toBe(1234);
  });

  it("getSloSnapshotAction surfaces unreachable", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mSnap.mockResolvedValue({
      ok: false,
      code: "ERR_NETWORK",
      message: "ERR_NETWORK",
      status: 0,
    });
    const r = await getSloSnapshotAction();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.code).toBe("ERR_NETWORK");
  });
});
