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
  it("returns email when JWT payload includes one", () => {
    expect(readIdentityFromJwt(jwtWith({ email: "ops@example.com" }))).toEqual({
      email: "ops@example.com",
    });
  });

  it("ignores role and other extra fields (single-user admin)", () => {
    const id = readIdentityFromJwt(
      jwtWith({ email: "a@b.com", role: "anything", sub: "x" }),
    );
    expect(id).toEqual({ email: "a@b.com" });
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
