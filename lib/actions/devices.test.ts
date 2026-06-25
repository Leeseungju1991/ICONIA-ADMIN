import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({
  forceUnpairDevice: vi.fn(),
  markDeviceLost: vi.fn(),
}));

import { forceUnpairDevice, markDeviceLost } from "@/lib/adminApi";
import { revalidatePath } from "next/cache";
import { forceUnpairAction, markLostAction } from "./devices";

const mockedForceUnpair = forceUnpairDevice as unknown as ReturnType<typeof vi.fn>;
const mockedMarkLost = markDeviceLost as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidate = revalidatePath as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  cookieStore.get.mockReset();
  mockedForceUnpair.mockReset();
  mockedMarkLost.mockReset();
  mockedRevalidate.mockReset();
});

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

describe("forceUnpairAction", () => {
  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await forceUnpairAction(fd({ device_id: "d1", reason: "stolen" }));
    expect(r.ok).toBe(false);
    expect(mockedForceUnpair).not.toHaveBeenCalled();
  });

  it("returns error when device_id or reason missing", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await forceUnpairAction(fd({ device_id: "d1" }));
    expect(r.ok).toBe(false);
    expect(mockedForceUnpair).not.toHaveBeenCalled();
  });

  it("calls forceUnpairDevice + revalidates on success", async () => {
    cookieStore.get.mockReturnValue({ value: "j-xyz" });
    mockedForceUnpair.mockResolvedValue({ ok: true, data: { ok: true } });
    const r = await forceUnpairAction(fd({ device_id: "d1", reason: "lost in transit" }));
    expect(r).toEqual({ ok: true });
    expect(mockedForceUnpair).toHaveBeenCalledWith({
      jwt: "j-xyz",
      deviceId: "d1",
      reason: "lost in transit",
    });
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/devices/d1");
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/devices");
  });

  it("surfaces API error code/message and does not revalidate", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedForceUnpair.mockResolvedValue({
      ok: false,
      code: "ERR_OPERATOR_AUTH_EXPIRED",
      message: "expired",
      status: 401,
    });
    const r = await forceUnpairAction(fd({ device_id: "d1", reason: "reason here" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_OPERATOR_AUTH_EXPIRED");
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });
});

describe("markLostAction", () => {
  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await markLostAction(fd({ device_id: "d1" }));
    expect(r.ok).toBe(false);
    expect(mockedMarkLost).not.toHaveBeenCalled();
  });

  it("returns error when device_id missing", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await markLostAction(fd({ note: "x" }));
    expect(r.ok).toBe(false);
    expect(mockedMarkLost).not.toHaveBeenCalled();
  });

  it("calls markDeviceLost with optional note + revalidates", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedMarkLost.mockResolvedValue({ ok: true, data: { ok: true } });
    const r = await markLostAction(fd({ device_id: "d2", note: "user reported" }));
    expect(r).toEqual({ ok: true });
    expect(mockedMarkLost).toHaveBeenCalledWith({ jwt: "j", deviceId: "d2", note: "user reported" });
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/devices/d2");
  });

  it("surfaces API error", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedMarkLost.mockResolvedValue({ ok: false, code: "ERR_DEVICE_NOT_FOUND", message: "nope", status: 404 });
    const r = await markLostAction(fd({ device_id: "d3" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_DEVICE_NOT_FOUND");
  });
});
