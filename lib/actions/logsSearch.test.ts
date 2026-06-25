import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/adminApi", () => ({
  searchLogs: vi.fn(),
}));

import { searchLogs } from "@/lib/adminApi";
import { searchLogsAction } from "./logsSearch";

const mSearch = searchLogs as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mSearch.mockReset();
});

describe("logsSearch action", () => {
  it("requires session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await searchLogsAction({});
    expect(r.ok).toBe(false);
    expect(mSearch).not.toHaveBeenCalled();
  });

  it("forwards filters to adminApi", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mSearch.mockResolvedValue({
      ok: true,
      data: { items: [], next_cursor: null, approx_total: 0 },
    });
    await searchLogsAction({
      level: "error",
      route: "/api/v1/admin",
      status: "5xx",
      q: "timeout",
    });
    expect(mSearch).toHaveBeenCalledOnce();
    const args = mSearch.mock.calls[0][0];
    expect(args.level).toBe("error");
    expect(args.route).toBe("/api/v1/admin");
    expect(args.status).toBe("5xx");
    expect(args.q).toBe("timeout");
  });

  it("returns items + next_cursor", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mSearch.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            at: "2026-05-27T00:00:00Z",
            level: "error",
            route: "/api/v1/foo",
            method: "GET",
            status: 500,
            request_id: "rid-1",
            user_id: null,
            operator_id: null,
            message: "boom",
            error_code: "ERR_X",
            extra: null,
          },
        ],
        next_cursor: "cur-2",
        approx_total: 17,
      },
    });
    const r = await searchLogsAction({ level: "error" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items).toHaveLength(1);
      expect(r.next_cursor).toBe("cur-2");
      expect(r.approx_total).toBe(17);
    }
  });
});
