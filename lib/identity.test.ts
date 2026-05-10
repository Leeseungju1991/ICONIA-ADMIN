import { describe, it, expect } from "vitest";
import { readIdentityFromJwt } from "./identity";

function jwtWith(payload: Record<string, unknown>): string {
  const enc = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj))
      .toString("base64")
      .replace(/=+$/, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  return `${enc({ alg: "RS256", typ: "JWT" })}.${enc(payload)}.sig`;
}

describe("readIdentityFromJwt", () => {
  it("returns email + null role when payload omits role", () => {
    expect(readIdentityFromJwt(jwtWith({ email: "ops@example.com" }))).toEqual({
      email: "ops@example.com",
      role: null,
    });
  });

  it("returns email + role when role is a known operator role", () => {
    expect(
      readIdentityFromJwt(jwtWith({ email: "sa@example.com", role: "superadmin" })),
    ).toEqual({ email: "sa@example.com", role: "superadmin" });
    expect(
      readIdentityFromJwt(jwtWith({ email: "v@example.com", role: "viewer" })),
    ).toEqual({ email: "v@example.com", role: "viewer" });
  });

  it("returns null role for unknown role values", () => {
    expect(
      readIdentityFromJwt(jwtWith({ email: "a@b.com", role: "god", sub: "x" })),
    ).toEqual({ email: "a@b.com", role: null });
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
