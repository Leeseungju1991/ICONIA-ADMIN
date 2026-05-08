import { describe, it, expect } from "vitest";
import { decodeJwtPayloadUnsafe } from "./jwt";

function makeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  const body = Buffer.from(JSON.stringify(payload))
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
  return `${header}.${body}.signature_placeholder`;
}

describe("decodeJwtPayloadUnsafe", () => {
  it("decodes a base64url payload", () => {
    const jwt = makeJwt({ sub: "o1", role: "cs", email: "a@b.com" });
    const payload = decodeJwtPayloadUnsafe(jwt);
    expect(payload).toEqual({ sub: "o1", role: "cs", email: "a@b.com" });
  });

  it("returns null on a malformed JWT (not 3 parts)", () => {
    expect(decodeJwtPayloadUnsafe("only.two")).toBeNull();
    expect(decodeJwtPayloadUnsafe("")).toBeNull();
  });

  it("returns null when payload is not valid JSON", () => {
    expect(decodeJwtPayloadUnsafe("aaa.!!!.bbb")).toBeNull();
  });

  it("returns null when input is null/undefined", () => {
    expect(decodeJwtPayloadUnsafe(null)).toBeNull();
    expect(decodeJwtPayloadUnsafe(undefined)).toBeNull();
  });
});
