import { describe, it, expect } from "vitest";
import {
  mockUser360Snapshot,
  mockUser360Timeline,
  type User360Snapshot,
  type User360Event,
} from "./mockUser360";

describe("mockUser360", () => {
  it("snapshot has user/devices/server/ai/app fields", () => {
    const snap: User360Snapshot = mockUser360Snapshot("demo@iconia.example");
    expect(snap.user.email).toBe("demo@iconia.example");
    expect(Array.isArray(snap.devices)).toBe(true);
    expect(snap.devices.length).toBeGreaterThan(0);
    expect(snap.server.active_sessions).toBeGreaterThanOrEqual(0);
    expect(snap.ai.persona_name).toBeTruthy();
    expect(snap.app.app_version).toMatch(/^\d/);
  });
  it("snapshot is deterministic for same key", () => {
    const a = mockUser360Snapshot("demo@iconia.example");
    const b = mockUser360Snapshot("demo@iconia.example");
    expect(a.user.id).toBe(b.user.id);
  });
  it("timeline returns reverse chronological events", () => {
    const evs: User360Event[] = mockUser360Timeline("demo@iconia.example");
    expect(evs.length).toBeGreaterThan(0);
    for (let i = 1; i < evs.length; i += 1) {
      expect(evs[i - 1].at >= evs[i].at).toBe(true);
    }
  });
  it("timeline event kinds are typed", () => {
    const evs = mockUser360Timeline("demo@iconia.example");
    const kinds = new Set(evs.map((e) => e.kind));
    for (const k of kinds) {
      expect(["login", "logout", "pairing", "ota", "report", "ai_fallback", "admin_action"]).toContain(k);
    }
  });
});
