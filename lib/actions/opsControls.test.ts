import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("@/lib/adminApi", () => ({
  closeCircuitBreaker: vi.fn(),
  invalidateCache: vi.fn(),
  setMaintenanceMode: vi.fn(),
}));

import {
  closeCircuitBreaker,
  invalidateCache,
  setMaintenanceMode,
} from "@/lib/adminApi";
import {
  closeCircuitAction,
  invalidateCacheAction,
  setMaintenanceAction,
} from "./opsControls";

const mCircuit = closeCircuitBreaker as unknown as ReturnType<typeof vi.fn>;
const mCache = invalidateCache as unknown as ReturnType<typeof vi.fn>;
const mMaint = setMaintenanceMode as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mCircuit.mockReset();
  mCache.mockReset();
  mMaint.mockReset();
});

describe("opsControls actions — reason guard", () => {
  it("closeCircuitAction rejects short reason", async () => {
    const r = await closeCircuitAction({ name: "ai_service", reason: "x" });
    expect(r.ok).toBe(false);
    expect(mCircuit).not.toHaveBeenCalled();
  });

  it("closeCircuitAction rejects empty name", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await closeCircuitAction({ name: "", reason: "valid reason" });
    expect(r.ok).toBe(false);
  });

  it("closeCircuitAction requires session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await closeCircuitAction({
      name: "ai_service",
      reason: "valid reason",
    });
    expect(r.ok).toBe(false);
    expect(mCircuit).not.toHaveBeenCalled();
  });

  it("closeCircuitAction passes through", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mCircuit.mockResolvedValue({
      ok: true,
      data: { ok: true, name: "ai_service", state: "closed" },
    });
    const r = await closeCircuitAction({
      name: "ai_service",
      reason: "AI 회복 후 강제 close",
    });
    expect(r.ok).toBe(true);
    expect(mCircuit).toHaveBeenCalledOnce();
  });

  it("invalidateCacheAction enforces selector + reason", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await invalidateCacheAction({
      selector: "",
      reason: "valid reason",
    });
    expect(r.ok).toBe(false);
  });

  it("invalidateCacheAction passes through", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mCache.mockResolvedValue({
      ok: true,
      data: { ok: true, selector: "all", cleared: 42 },
    });
    const r = await invalidateCacheAction({
      selector: "all",
      reason: "stale 키 일소",
    });
    expect(r.ok).toBe(true);
  });

  it("setMaintenanceAction passes through with until", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mMaint.mockResolvedValue({
      ok: true,
      data: { enabled: true, until: "2026-05-27T03:00:00Z" },
    });
    const r = await setMaintenanceAction({
      enabled: true,
      until: "2026-05-27T03:00:00Z",
      reason: "긴급 DB 마이그레이션 10분",
    });
    expect(r.ok).toBe(true);
    expect(mMaint).toHaveBeenCalledOnce();
    const args = mMaint.mock.calls[0][0];
    expect(args.enabled).toBe(true);
    expect(args.until).toBe("2026-05-27T03:00:00Z");
  });

  it("setMaintenanceAction surfaces unreachable as failure", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mMaint.mockResolvedValue({
      ok: false,
      code: "ERR_NETWORK",
      message: "ERR_NETWORK",
      status: 0,
    });
    const r = await setMaintenanceAction({
      enabled: false,
      reason: "정상 운영 재개",
    });
    expect(r.ok).toBe(false);
  });
});
