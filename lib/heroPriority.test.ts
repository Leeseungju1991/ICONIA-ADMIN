import { describe, it, expect } from "vitest";
import { resolveHeroMode, type HeroInput } from "./heroPriority";

const base: HeroInput = {
  firmware_critical_count: 0,
  reports_pending: 0,
  server_health: "ok",
  dead_letter_count: 0,
  errors_24h: 0,
};

describe("resolveHeroMode", () => {
  it("critical when firmware_critical_count > 0", () => {
    expect(resolveHeroMode({ ...base, firmware_critical_count: 1 }).mode).toBe("critical");
  });
  it("critical when server_health=down", () => {
    expect(resolveHeroMode({ ...base, server_health: "down" }).mode).toBe("critical");
  });
  it("critical when dead_letter_count > 100", () => {
    expect(resolveHeroMode({ ...base, dead_letter_count: 101 }).mode).toBe("critical");
  });
  it("warn when reports_pending > 0", () => {
    expect(resolveHeroMode({ ...base, reports_pending: 3 }).mode).toBe("warn");
  });
  it("warn when server_health=degraded", () => {
    expect(resolveHeroMode({ ...base, server_health: "degraded" }).mode).toBe("warn");
  });
  it("warn when errors_24h > 1000", () => {
    expect(resolveHeroMode({ ...base, errors_24h: 1001 }).mode).toBe("warn");
  });
  it("ok with empty signals", () => {
    const out = resolveHeroMode(base);
    expect(out.mode).toBe("ok");
    expect(out.title).toContain("정상");
  });
  it("critical overrides warn", () => {
    const out = resolveHeroMode({ ...base, firmware_critical_count: 2, reports_pending: 5 });
    expect(out.mode).toBe("critical");
  });
  it("critical includes CTA href", () => {
    const out = resolveHeroMode({ ...base, firmware_critical_count: 2 });
    expect(out.cta?.href).toBe("/dashboard/firmware-errors");
  });
});
