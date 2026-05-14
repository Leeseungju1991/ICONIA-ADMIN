import { describe, it, expect, vi } from "vitest";

vi.mock("next/server", () => {
  class FakeNextResponse {
    static next() {
      return { kind: "next" } as const;
    }
    static redirect(url: URL) {
      return {
        kind: "redirect",
        url: url.toString(),
        cookies: { delete: (_n: string) => undefined },
      } as const;
    }
  }
  return { NextResponse: FakeNextResponse };
});

import { middleware, config } from "./middleware";

function enc(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj))
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}
function jwtWith(payload: Record<string, unknown>): string {
  return `${enc({ alg: "RS256", typ: "JWT" })}.${enc(payload)}.sig`;
}
const FUTURE_EXP = Math.floor(Date.now() / 1000) + 3600; // 1h 뒤
const PAST_EXP = Math.floor(Date.now() / 1000) - 60;     // 1분 전

function makeRequest(pathname: string, cookieValue: string | null) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    nextUrl: url,
    url: url.toString(),
    cookies: {
      get: (_name: string) => (cookieValue ? { value: cookieValue } : undefined),
    },
  } as unknown as Parameters<typeof middleware>[0];
}

describe("middleware", () => {
  it("passes through /dashboard when valid superadmin JWT present", () => {
    const jwt = jwtWith({ email: "ops@example.com", role: "superadmin", exp: FUTURE_EXP });
    const result = middleware(makeRequest("/dashboard", jwt));
    expect((result as unknown as { kind: string }).kind).toBe("next");
  });

  it("redirects to /login when /dashboard accessed without cookie", () => {
    const result = middleware(makeRequest("/dashboard", null));
    expect((result as unknown as { kind: string }).kind).toBe("redirect");
    expect((result as unknown as { url: string }).url).toContain("/login");
  });

  it("redirects to /login when JWT is malformed", () => {
    const result = middleware(makeRequest("/dashboard", "garbage"));
    expect((result as unknown as { kind: string }).kind).toBe("redirect");
    expect((result as unknown as { url: string }).url).toContain("reason=invalid");
  });

  it("redirects to /login when JWT is expired", () => {
    const jwt = jwtWith({ email: "ops@example.com", role: "superadmin", exp: PAST_EXP });
    const result = middleware(makeRequest("/dashboard", jwt));
    expect((result as unknown as { kind: string }).kind).toBe("redirect");
    expect((result as unknown as { url: string }).url).toContain("reason=expired");
  });

  it("redirects forbidden when viewer accesses /dashboard/operators (superadmin only)", () => {
    const jwt = jwtWith({ email: "viewer@example.com", role: "viewer", exp: FUTURE_EXP });
    const result = middleware(makeRequest("/dashboard/operators", jwt));
    expect((result as unknown as { kind: string }).kind).toBe("redirect");
    expect((result as unknown as { url: string }).url).toContain("reason=forbidden");
  });

  it("allows superadmin into /dashboard/operators", () => {
    const jwt = jwtWith({ email: "sa@example.com", role: "superadmin", exp: FUTURE_EXP });
    const result = middleware(makeRequest("/dashboard/operators", jwt));
    expect((result as unknown as { kind: string }).kind).toBe("next");
  });

  it("config matcher only includes /dashboard*", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*"]);
  });
});
