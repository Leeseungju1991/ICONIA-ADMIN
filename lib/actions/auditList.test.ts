import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/auditApi", () => ({
  listAuditLog: vi.fn(),
}));

import { listAuditLog } from "@/lib/auditApi";
import { listAuditLogAction } from "./auditList";

const mList = listAuditLog as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mList.mockReset();
});

describe("auditList action", () => {
  it("requires session", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await listAuditLogAction({});
    expect(r.ok).toBe(false);
    expect(mList).not.toHaveBeenCalled();
  });

  it("forwards filters", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mList.mockResolvedValue({
      ok: true,
      data: {
        items: [],
        next_cursor: null,
        since: "2026-05-26T00:00:00Z",
      },
    });
    await listAuditLogAction({
      action: "user.force_logout",
      operatorId: "op-1",
      targetType: "user",
      limit: 50,
    });
    expect(mList).toHaveBeenCalledOnce();
    const args = mList.mock.calls[0][0];
    expect(args.action).toBe("user.force_logout");
    expect(args.operatorId).toBe("op-1");
    expect(args.targetType).toBe("user");
    expect(args.limit).toBe(50);
  });

  it("returns items + cursor", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mList.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "a1",
            sequence_no: 1,
            action: "user.force_logout",
            user_id: null,
            operator_id: "op-1",
            operator_role: "cs",
            target_resource_type: "user",
            target_resource_id: "u-1",
            action_outcome: "success",
            ip: "10.0.0.1",
            user_agent: "ua",
            metadata: null,
            created_at: "2026-05-27T00:00:00Z",
            request_id: "rid",
            prev_hash: null,
            current_hash: "h",
          },
        ],
        next_cursor: null,
        since: "2026-05-26T00:00:00Z",
      },
    });
    const r = await listAuditLogAction({});
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.items).toHaveLength(1);
      expect(r.since).toBe("2026-05-26T00:00:00Z");
    }
  });
});
