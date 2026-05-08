import { describe, it, expect, vi } from "vitest";

vi.mock("next/server", () => {
  class FakeNextResponse {
    static next() {
      return { kind: "next" } as const;
    }
    static redirect(url: URL) {
      return { kind: "redirect", url: url.toString() } as const;
    }
  }
  return { NextResponse: FakeNextResponse };
});

import { middleware, config } from "./middleware";

function makeRequest(pathname: string, hasCookie: boolean) {
  const url = new URL(`http://localhost${pathname}`);
  return {
    nextUrl: url,
    url: url.toString(),
    cookies: {
      get: (_name: string) => (hasCookie ? { value: "j" } : undefined),
    },
  } as unknown as Parameters<typeof middleware>[0];
}

describe("middleware", () => {
  it("passes through /dashboard when cookie present", () => {
    const result = middleware(makeRequest("/dashboard", true));
    expect((result as unknown as { kind: string }).kind).toBe("next");
  });

  it("redirects to /login when /dashboard accessed without cookie", () => {
    const result = middleware(makeRequest("/dashboard", false));
    expect((result as unknown as { kind: string }).kind).toBe("redirect");
    expect((result as unknown as { url: string }).url).toContain("/login");
  });

  it("redirects to /login when /dashboard/users accessed without cookie", () => {
    const result = middleware(makeRequest("/dashboard/users", false));
    expect((result as unknown as { kind: string }).kind).toBe("redirect");
  });

  it("config matcher only includes /dashboard*", () => {
    expect(config.matcher).toEqual(["/dashboard/:path*"]);
  });
});
