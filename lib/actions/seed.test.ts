import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/adminApi", () => ({
  getAdminSeedStatus: vi.fn(),
  runAdminSeed: vi.fn(),
}));

import { getAdminSeedStatus, runAdminSeed } from "@/lib/adminApi";
import { getSeedStatusAction, runSeedAction } from "./seed";

const mStatus = getAdminSeedStatus as unknown as ReturnType<typeof vi.fn>;
const mRun = runAdminSeed as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mStatus.mockReset();
  mRun.mockReset();
});

describe("seed actions", () => {
  it("getSeedStatusAction returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await getSeedStatusAction();
    expect(r.ok).toBe(false);
    expect(mStatus).not.toHaveBeenCalled();
  });

  it("getSeedStatusAction returns server data", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mStatus.mockResolvedValue({
      ok: true,
      data: {
        last_run_at: "2026-05-26T03:00:00Z",
        last_run_by: "web@soomkorea.com",
        duration_ms: 1234,
        counts: { users: 100, products: 12 },
      },
    });
    const r = await getSeedStatusAction();
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.counts.users).toBe(100);
  });

  it("getSeedStatusAction surfaces server error", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mStatus.mockResolvedValue({
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "ERR_SERVER_UNAVAILABLE",
      status: 503,
    });
    const r = await getSeedStatusAction();
    expect(r.ok).toBe(false);
  });

  it("runSeedAction requires session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await runSeedAction({ reason: "demo refresh" });
    expect(r.ok).toBe(false);
    expect(mRun).not.toHaveBeenCalled();
  });

  it("runSeedAction posts reason + returns result", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mRun.mockResolvedValue({
      ok: true,
      data: {
        started_at: "2026-05-26T03:00:00Z",
        finished_at: "2026-05-26T03:00:02Z",
        duration_ms: 2000,
        counts: { users: 100 },
      },
    });
    const r = await runSeedAction({ reason: "demo refresh" });
    expect(r.ok).toBe(true);
    expect(mRun).toHaveBeenCalledWith({ jwt: "j", reason: "demo refresh" });
  });
});
