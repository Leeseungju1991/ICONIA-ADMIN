import { describe, it, expect, beforeEach, vi } from "vitest";

// resolveIdentity 는 @/lib/adminApi 의 getOperatorMe 를 호출한다 — mock 으로 격리.
vi.mock("@/lib/adminApi", () => ({ getOperatorMe: vi.fn() }));

import { getOperatorMe } from "@/lib/adminApi";
import { readIdentityFromJwt, resolveIdentity } from "./identity";

const mockedGetMe = getOperatorMe as unknown as ReturnType<typeof vi.fn>;

function jwtWith(payload: Record<string, unknown>): string {
  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${enc({ alg: "RS256", typ: "JWT" })}.${enc(payload)}.sig`;
}

beforeEach(() => {
  mockedGetMe.mockReset();
});

describe("readIdentityFromJwt", () => {
  it("returns email + null role + null id when payload omits role/sub", () => {
    expect(readIdentityFromJwt(jwtWith({ email: "ops@example.com" }))).toEqual({
      email: "ops@example.com",
      role: null,
      id: null,
      source: "jwt",
    });
  });

  it("returns email + role when role is a known operator role", () => {
    expect(
      readIdentityFromJwt(jwtWith({ email: "sa@example.com", role: "superadmin" })),
    ).toEqual({ email: "sa@example.com", role: "superadmin", id: null, source: "jwt" });
    expect(
      readIdentityFromJwt(jwtWith({ email: "v@example.com", role: "viewer" })),
    ).toEqual({ email: "v@example.com", role: "viewer", id: null, source: "jwt" });
  });

  it("returns id from sub when present", () => {
    expect(
      readIdentityFromJwt(
        jwtWith({ email: "sa@example.com", role: "superadmin", sub: "op-uuid-1" }),
      ),
    ).toEqual({
      email: "sa@example.com",
      role: "superadmin",
      id: "op-uuid-1",
      source: "jwt",
    });
  });

  it("returns null role for unknown role values", () => {
    expect(
      readIdentityFromJwt(jwtWith({ email: "a@b.com", role: "god", sub: "x" })),
    ).toEqual({ email: "a@b.com", role: null, id: "x", source: "jwt" });
  });

  it("returns null when email is missing", () => {
    expect(readIdentityFromJwt(jwtWith({ sub: "x" }))).toBeNull();
  });

  it("returns null on malformed JWT", () => {
    expect(readIdentityFromJwt("garbage")).toBeNull();
    expect(readIdentityFromJwt(null)).toBeNull();
    expect(readIdentityFromJwt(undefined)).toBeNull();
  });
});

describe("resolveIdentity", () => {
  it("returns null when no jwt is provided", async () => {
    expect(await resolveIdentity(null)).toBeNull();
    expect(await resolveIdentity(undefined)).toBeNull();
    expect(mockedGetMe).not.toHaveBeenCalled();
  });

  it("uses server-verified identity from /operator/me when available", async () => {
    mockedGetMe.mockResolvedValue({
      ok: true,
      data: { id: "srv-1", email: "verified@example.com", role: "sre" },
    });
    const id = await resolveIdentity(jwtWith({ email: "stale@example.com", sub: "stale" }));
    expect(id).toEqual({
      email: "verified@example.com",
      role: "sre",
      id: "srv-1",
      source: "server",
    });
  });

  it("coerces an unknown server role to null but keeps email/id", async () => {
    mockedGetMe.mockResolvedValue({
      ok: true,
      data: { id: "srv-2", email: "x@example.com", role: "wizard" },
    });
    const id = await resolveIdentity(jwtWith({ email: "x@example.com" }));
    expect(id).toEqual({
      email: "x@example.com",
      role: null,
      id: "srv-2",
      source: "server",
    });
  });

  it("falls back to JWT payload when server is unreachable (network error)", async () => {
    mockedGetMe.mockResolvedValue({
      ok: false,
      code: "ERR_NETWORK",
      message: "network_error",
      status: 0,
    });
    const id = await resolveIdentity(
      jwtWith({ email: "fallback@example.com", role: "cs", sub: "j-1" }),
    );
    expect(id).toEqual({
      email: "fallback@example.com",
      role: "cs",
      id: "j-1",
      source: "jwt",
    });
  });

  it("falls back to JWT payload when server returns 5xx", async () => {
    mockedGetMe.mockResolvedValue({
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "server_unavailable",
      status: 503,
    });
    const id = await resolveIdentity(jwtWith({ email: "f@example.com", sub: "j-2" }));
    expect(id?.source).toBe("jwt");
    expect(id?.email).toBe("f@example.com");
  });

  it("returns null (no fallback) when the token is rejected as unauthenticated", async () => {
    mockedGetMe.mockResolvedValue({
      ok: false,
      code: "ERR_UNAUTHORIZED",
      message: "unauthorized",
      status: 401,
    });
    expect(await resolveIdentity(jwtWith({ email: "f@example.com" }))).toBeNull();
  });

  it("returns null on 403 forbidden without falling back to a forged payload", async () => {
    mockedGetMe.mockResolvedValue({
      ok: false,
      code: "ERR_FORBIDDEN",
      message: "forbidden",
      status: 403,
    });
    expect(await resolveIdentity(jwtWith({ email: "f@example.com" }))).toBeNull();
  });

  it("falls back to JWT when getOperatorMe unexpectedly throws", async () => {
    mockedGetMe.mockRejectedValue(new Error("boom"));
    const id = await resolveIdentity(jwtWith({ email: "f@example.com", sub: "j-3" }));
    expect(id?.source).toBe("jwt");
  });
});
