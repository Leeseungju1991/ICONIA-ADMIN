import { describe, it, expect, beforeEach, vi } from "vitest";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/adminApi", () => ({
  syncProducts: vi.fn(),
  syncCategories: vi.fn(),
  syncOrders: vi.fn(),
}));

import { syncProducts, syncCategories, syncOrders } from "@/lib/adminApi";
import { revalidatePath } from "next/cache";
import { syncProductsAction, syncCategoriesAction, syncOrdersAction } from "./commerce";

const mockedProducts = syncProducts as unknown as ReturnType<typeof vi.fn>;
const mockedCategories = syncCategories as unknown as ReturnType<typeof vi.fn>;
const mockedOrders = syncOrders as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidate = revalidatePath as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.get.mockReset();
  mockedProducts.mockReset();
  mockedCategories.mockReset();
  mockedOrders.mockReset();
  mockedRevalidate.mockReset();
});

describe("syncProductsAction", () => {
  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await syncProductsAction();
    expect(r.ok).toBe(false);
    expect(mockedProducts).not.toHaveBeenCalled();
  });

  it("returns synced count + revalidates products page", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedProducts.mockResolvedValue({ ok: true, data: { synced: 12 } });
    const r = await syncProductsAction();
    expect(r).toEqual({ ok: true, synced: 12 });
    expect(mockedProducts).toHaveBeenCalledWith({ jwt: "j" });
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/commerce/products");
  });

  it("surfaces API error", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedProducts.mockResolvedValue({ ok: false, code: "ERR_SERVER_UNAVAILABLE", message: "down", status: 503 });
    const r = await syncProductsAction();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_SERVER_UNAVAILABLE");
    expect(mockedRevalidate).not.toHaveBeenCalled();
  });
});

describe("syncCategoriesAction", () => {
  it("returns synced count + revalidates products page", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedCategories.mockResolvedValue({ ok: true, data: { synced: 3 } });
    const r = await syncCategoriesAction();
    expect(r).toEqual({ ok: true, synced: 3 });
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/commerce/products");
  });

  it("returns session-expired when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const r = await syncCategoriesAction();
    expect(r.ok).toBe(false);
    expect(mockedCategories).not.toHaveBeenCalled();
  });
});

describe("syncOrdersAction", () => {
  it("returns synced count + revalidates orders page", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedOrders.mockResolvedValue({ ok: true, data: { synced: 7 } });
    const r = await syncOrdersAction();
    expect(r).toEqual({ ok: true, synced: 7 });
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/commerce/orders");
  });

  it("surfaces API error", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedOrders.mockResolvedValue({ ok: false, code: "ERR_RATE_LIMITED", message: "slow down", status: 429 });
    const r = await syncOrdersAction();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.message).toContain("ERR_RATE_LIMITED");
  });
});
