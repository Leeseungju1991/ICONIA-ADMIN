import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("@/lib/adminApi", () => ({
  listRightsRequests: vi.fn(),
  transitionRightsRequest: vi.fn(),
  listPipaUsers: vi.fn(),
}));

import {
  listRightsRequests,
  transitionRightsRequest,
  listPipaUsers,
} from "@/lib/adminApi";
import { listRightsRequestsAction, transitionRightsAction } from "./rights";

const mList = listRightsRequests as unknown as ReturnType<typeof vi.fn>;
const mTransition = transitionRightsRequest as unknown as ReturnType<typeof vi.fn>;
const mPipa = listPipaUsers as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mList.mockReset();
  mTransition.mockReset();
  mPipa.mockReset();
});

describe("listRightsRequestsAction", () => {
  it("requires session cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await listRightsRequestsAction();
    expect(r.ok).toBe(false);
  });

  it("returns Server items directly when reachable", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-x" });
    mList.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            id: "r1",
            user_id: "u1",
            kind: "access",
            status: "received",
            user_reason: "ok",
            operator_note: null,
            received_at: new Date().toISOString(),
            closed_at: null,
            operator_id_closed: null,
          },
        ],
      },
    });
    const r = await listRightsRequestsAction();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.placeholder).toBe(false);
      expect(r.data.items.length).toBe(1);
    }
  });

  it("falls back to PIPA pending_deletion + placeholders on ERR_NETWORK", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-x" });
    mList.mockResolvedValue({ ok: false, code: "ERR_NETWORK", message: "x", status: 0 });
    mPipa.mockResolvedValue({
      ok: true,
      data: {
        items: [
          {
            user_id: "pu1",
            account_status: "pending_deletion",
            pending_deletion_at: new Date().toISOString(),
            scheduled_purge_at: null,
            recent_export_at: null,
          },
        ],
      },
    });
    const r = await listRightsRequestsAction();
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.placeholder).toBe(true);
      expect(r.data.pipa_augmented).toBe(true);
      // 1 pipa-derived + 2 placeholders.
      expect(r.data.items.length).toBe(3);
      const pipaRow = r.data.items.find((i) => i.id.startsWith("pipa-"));
      expect(pipaRow?.kind).toBe("delete");
    }
  });

  it("filters fallback items by kind", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-x" });
    mList.mockResolvedValue({ ok: false, code: "ERR_NETWORK", message: "x", status: 0 });
    mPipa.mockResolvedValue({ ok: true, data: { items: [] } });
    const r = await listRightsRequestsAction({ kind: "access" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.items.every((i) => i.kind === "access")).toBe(true);
    }
  });
});

describe("transitionRightsAction", () => {
  beforeEach(() => {
    cookieStore.get.mockReturnValue({ value: "jwt-x" });
  });

  it("requires reason >= 5 chars", async () => {
    const r = await transitionRightsAction({ id: "r1", next_status: "completed", reason: "x" });
    expect(r.ok).toBe(false);
    expect(mTransition).not.toHaveBeenCalled();
  });

  it("forwards trimmed reason on valid input", async () => {
    mTransition.mockResolvedValue({
      ok: true,
      data: {
        id: "r1",
        user_id: "u1",
        kind: "access",
        status: "completed",
        user_reason: null,
        operator_note: null,
        received_at: new Date().toISOString(),
        closed_at: new Date().toISOString(),
        operator_id_closed: "op1",
      },
    });
    const r = await transitionRightsAction({
      id: "r1",
      next_status: "completed",
      reason: "  valid reason  ",
    });
    expect(r.ok).toBe(true);
    expect(mTransition).toHaveBeenCalledWith({
      jwt: "jwt-x",
      id: "r1",
      next_status: "completed",
      reason: "valid reason",
    });
  });
});
