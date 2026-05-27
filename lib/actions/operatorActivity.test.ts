import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
vi.mock("next/headers", () => ({
  cookies: () => ({ get: (k: string) => (k === "iconia_admin_jwt" ? { value: "jwt" } : undefined) }),
}));
import { fetchOperatorActivityAction } from "./operatorActivity";

beforeEach(() => { process.env.ICONIA_SERVER_URL = "http://server.test"; });
afterEach(() => { globalThis.fetch = global.fetch; });

describe("fetchOperatorActivityAction", () => {
  it("falls back to mock on network fail", async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error("x"); });
    const r = await fetchOperatorActivityAction();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("mock");
      expect(r.weekly.length).toBe(7);
      expect(r.collaborators.length).toBeLessThanOrEqual(4);
    }
  });
});
