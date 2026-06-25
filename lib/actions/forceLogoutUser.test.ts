import { describe, it, expect, beforeEach, vi } from "vitest";
import { makeRedirect, expectRedirect } from "../../test/helpers/captureRedirect";

const cookieStore = { set: vi.fn(), delete: vi.fn(), get: vi.fn() };
vi.mock("next/headers", () => ({ cookies: async () => cookieStore }));
vi.mock("next/navigation", () => ({
  get redirect() {
    return makeRedirect();
  },
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("../adminApi", () => ({
  forceLogoutUser: vi.fn(),
}));

import { forceLogoutUser as apiCall } from "../adminApi";
import { revalidatePath } from "next/cache";
import { forceLogoutUserAction } from "./forceLogoutUser";

const mockedApi = apiCall as unknown as ReturnType<typeof vi.fn>;
const mockedRevalidate = revalidatePath as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  cookieStore.set.mockReset();
  cookieStore.delete.mockReset();
  cookieStore.get.mockReset();
  mockedApi.mockReset();
  mockedRevalidate.mockReset();
  process.env.ICONIA_SERVER_URL = "https://api.example.com";
});

function fd(input: Record<string, string>): FormData {
  const f = new FormData();
  for (const [k, v] of Object.entries(input)) f.append(k, v);
  return f;
}

describe("forceLogoutUserAction", () => {
  it("redirects to /login when no session cookie", async () => {
    cookieStore.get.mockReturnValue(undefined);
    const url = await expectRedirect(() =>
      forceLogoutUserAction(fd({ user_id: "u1" })),
    );
    expect(url).toBe("/login?reason=expired");
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("returns ERR_VALIDATION_LOCAL when user_id missing", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    const r = await forceLogoutUserAction(fd({}));
    expect(r.status).toBe("error");
    expect(r.code).toBe("ERR_VALIDATION_LOCAL");
    expect(mockedApi).not.toHaveBeenCalled();
  });

  it("calls forceLogoutUser API with JWT and user_id and revalidates detail page", async () => {
    cookieStore.get.mockReturnValue({ value: "j-xyz" });
    mockedApi.mockResolvedValue({ ok: true, data: { revoked_count: 3 } });

    const r = await forceLogoutUserAction(fd({ user_id: "u1" }));

    expect(mockedApi).toHaveBeenCalledWith({ jwt: "j-xyz", userId: "u1" });
    expect(r.status).toBe("idle");
    expect(r.message).toContain("3");
    expect(mockedRevalidate).toHaveBeenCalledWith("/dashboard/users/u1");
  });

  it("on ERR_OPERATOR_AUTH_EXPIRED clears session and redirects to /login?reason=expired", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedApi.mockResolvedValue({
      ok: false,
      code: "ERR_OPERATOR_AUTH_EXPIRED",
      message: "x",
      status: 401,
    });
    const url = await expectRedirect(() =>
      forceLogoutUserAction(fd({ user_id: "u1" })),
    );
    expect(url).toBe("/login?reason=expired");
    expect(cookieStore.delete).toHaveBeenCalledWith("iconia_admin_session");
  });

  it("returns error state on ERR_USER_NOT_FOUND without redirecting", async () => {
    cookieStore.get.mockReturnValue({ value: "j" });
    mockedApi.mockResolvedValue({
      ok: false,
      code: "ERR_USER_NOT_FOUND",
      message: "x",
      status: 404,
    });
    const r = await forceLogoutUserAction(fd({ user_id: "u1" }));
    expect(r.status).toBe("error");
    expect(r.code).toBe("ERR_USER_NOT_FOUND");
  });
});
