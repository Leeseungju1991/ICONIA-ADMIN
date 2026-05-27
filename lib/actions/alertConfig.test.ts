import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("@/lib/adminApi", () => ({
  getAlertConfig: vi.fn(),
  updateAlertRule: vi.fn(),
}));

import { getAlertConfig, updateAlertRule } from "@/lib/adminApi";
import {
  getAlertConfigAction,
  updateAlertRuleAction,
} from "./alertConfig";

const mGet = getAlertConfig as unknown as ReturnType<typeof vi.fn>;
const mPut = updateAlertRule as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mGet.mockReset();
  mPut.mockReset();
});

describe("alertConfig actions", () => {
  it("getAlertConfigAction requires session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await getAlertConfigAction();
    expect(r.ok).toBe(false);
  });

  it("getAlertConfigAction returns rules", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mGet.mockResolvedValue({
      ok: true,
      data: { rules: [], channels: [] },
    });
    const r = await getAlertConfigAction();
    expect(r.ok).toBe(true);
  });

  it("updateAlertRuleAction rejects short reason", async () => {
    const r = await updateAlertRuleAction({
      key: "api.p95.global",
      threshold: 250,
      reason: "ok",
    });
    expect(r.ok).toBe(false);
    expect(mPut).not.toHaveBeenCalled();
  });

  it("updateAlertRuleAction requires session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await updateAlertRuleAction({
      key: "api.p95.global",
      threshold: 250,
      reason: "valid 5-char reason",
    });
    expect(r.ok).toBe(false);
    expect(mPut).not.toHaveBeenCalled();
  });

  it("updateAlertRuleAction sends patch + reason", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mPut.mockResolvedValue({
      ok: true,
      data: {
        key: "api.p95.global",
        label: "API p95 global",
        unit: "ms",
        threshold: 250,
        enabled: true,
        channels: ["slack"],
        note: null,
        updated_at: "2026-05-27T00:00:00Z",
      },
    });
    const r = await updateAlertRuleAction({
      key: "api.p95.global",
      threshold: 250,
      enabled: true,
      channels: ["slack"],
      reason: "p95 임계 250 로 완화",
    });
    expect(r.ok).toBe(true);
    expect(mPut).toHaveBeenCalledOnce();
    const args = mPut.mock.calls[0][0];
    expect(args.key).toBe("api.p95.global");
    expect(args.patch.threshold).toBe(250);
    expect(args.reason).toBe("p95 임계 250 로 완화");
  });
});
