import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeRedirect, expectRedirect } from "../../test/helpers/captureRedirect";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: () => cookieStore }));
vi.mock("next/navigation", () => ({
  get redirect() {
    return makeRedirect();
  },
}));
vi.mock("../serverApi", () => ({
  operatorLogout: vi.fn(),
}));

import { operatorLogout } from "../serverApi";
import { idleLogoutAction } from "./idleLogout";

const mockedLogout = operatorLogout as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  cookieStore.get.mockReset();
  mockedLogout.mockReset();
  process.env.ICONIA_SERVER_URL = "https://api.example.com";
});

describe("idleLogoutAction", () => {
  it("clears cookie and redirects /login?reason=idle when JWT present", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-xyz" });
    mockedLogout.mockResolvedValue({ ok: true, data: { revoked: true } });

    const url = await expectRedirect(() => idleLogoutAction());

    expect(url).toBe("/login?reason=idle");
    expect(mockedLogout).toHaveBeenCalledWith("jwt-xyz");
    expect(cookieStore.delete).toHaveBeenCalledWith("iconia_admin_session");
  });

  it("still clears cookie + redirects when server logout returns error", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-xyz" });
    mockedLogout.mockResolvedValue({
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "x",
      status: 503,
    });

    const url = await expectRedirect(() => idleLogoutAction());

    expect(url).toBe("/login?reason=idle");
    expect(cookieStore.delete).toHaveBeenCalledWith("iconia_admin_session");
  });

  it("redirects /login?reason=idle without calling server when no cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);

    const url = await expectRedirect(() => idleLogoutAction());

    expect(url).toBe("/login?reason=idle");
    expect(mockedLogout).not.toHaveBeenCalled();
    expect(cookieStore.delete).toHaveBeenCalledWith("iconia_admin_session");
  });

  it("still clears cookie when serverApi throws unexpectedly", async () => {
    cookieStore.get.mockReturnValue({ value: "jwt-xyz" });
    mockedLogout.mockRejectedValue(new Error("boom"));

    const url = await expectRedirect(() => idleLogoutAction());

    expect(url).toBe("/login?reason=idle");
    expect(cookieStore.delete).toHaveBeenCalledWith("iconia_admin_session");
  });
});
