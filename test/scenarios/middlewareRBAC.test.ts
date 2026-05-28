// Middleware Edge runtime — RBAC + 세션 강제 (시나리오 #1, #3, #5, #9, #25).
//
// `middleware.ts` 는 모든 /dashboard /admin /security 경로의 SSR 진입을 가드한다.
// 본 테스트는 각 분기를 stub NextRequest 로 직접 호출해 검증한다.

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Stub Next.js server primitives — vitest 의 jsdom 환경은 next/server 의 edge
// runtime polyfills 가 없어 직접 모킹한다.
type ResponseLike = {
  cookies: { set: ReturnType<typeof vi.fn>; delete: ReturnType<typeof vi.fn> };
  __type: "next" | "redirect";
  __url?: string;
};

const mocks = vi.hoisted(() => {
  return {
    nextResponseMock: {
      next: vi.fn(),
      redirect: vi.fn(),
    },
  };
});

vi.mock("next/server", () => ({
  NextResponse: mocks.nextResponseMock,
}));

// AbortSignal.timeout polyfill (jsdom 일부 빌드에 누락).
if (typeof (AbortSignal as { timeout?: (ms: number) => AbortSignal }).timeout !== "function") {
  (AbortSignal as { timeout: (ms: number) => AbortSignal }).timeout = (ms: number) => {
    const ctl = new AbortController();
    setTimeout(() => ctl.abort(), ms);
    return ctl.signal;
  };
}

import { middleware } from "@/middleware";

type ReqStub = {
  cookies: { get: (name: string) => { value: string } | undefined };
  nextUrl: URL & { clone(): URL };
};

function makeRequest(opts: { url: string; cookie?: string }): ReqStub {
  const url = new URL(opts.url);
  // Stub clone() — URL has no .clone(); polyfill it.
  (url as URL & { clone(): URL }).clone = () => {
    const u = new URL(url.toString());
    (u as URL & { clone(): URL }).clone = (url as URL & { clone(): URL }).clone;
    return u;
  };
  return {
    cookies: {
      get(name: string) {
        if (name === "iconia_admin_session" && opts.cookie) {
          return { value: opts.cookie };
        }
        return undefined;
      },
    },
    nextUrl: url as URL & { clone(): URL },
  };
}

function base64UrlEncode(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function mintJwt(payload: Record<string, unknown>): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
  const body = base64UrlEncode(JSON.stringify(payload));
  return `${header}.${body}.`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

beforeEach(() => {
  mocks.nextResponseMock.next.mockReset();
  mocks.nextResponseMock.redirect.mockReset();
  mocks.nextResponseMock.next.mockImplementation((): ResponseLike => ({
    cookies: { set: vi.fn(), delete: vi.fn() },
    __type: "next",
  }));
  mocks.nextResponseMock.redirect.mockImplementation((url: URL): ResponseLike => ({
    cookies: { set: vi.fn(), delete: vi.fn() },
    __type: "redirect",
    __url: url.toString(),
  }));
  delete process.env.ICONIA_SERVER_URL;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("middleware — 미인증 진입 (#1, #5)", () => {
  it("쿠키 없음 → /login?reason=missing 으로 redirect", async () => {
    const req = makeRequest({ url: "http://localhost:3000/dashboard" });
    const res = (await middleware(req as unknown as Parameters<typeof middleware>[0])) as unknown as ResponseLike;
    expect(res.__type).toBe("redirect");
    expect(res.__url).toContain("/login");
    expect(res.__url).toContain("reason=missing");
  });
});

describe("middleware — 세션 만료 (#3, #4)", () => {
  it("JWT exp 가 과거 → /login?reason=expired + cookie 삭제", async () => {
    const expiredJwt = mintJwt({ role: "superadmin", exp: nowSec() - 60 });
    const req = makeRequest({
      url: "http://localhost:3000/dashboard",
      cookie: expiredJwt,
    });
    const res = (await middleware(req as unknown as Parameters<typeof middleware>[0])) as unknown as ResponseLike;
    expect(res.__type).toBe("redirect");
    expect(res.__url).toContain("reason=expired");
    expect(res.cookies.delete).toHaveBeenCalledWith("iconia_admin_session");
  });
});

describe("middleware — RBAC 차단 (#9)", () => {
  it("viewer role → /dashboard/operators 접근 시 forbidden redirect", async () => {
    const jwt = mintJwt({ role: "viewer", exp: nowSec() + 3600 });
    const req = makeRequest({
      url: "http://localhost:3000/dashboard/operators",
      cookie: jwt,
    });
    const res = (await middleware(req as unknown as Parameters<typeof middleware>[0])) as unknown as ResponseLike;
    expect(res.__type).toBe("redirect");
    expect(res.__url).toContain("/dashboard");
    expect(res.__url).toContain("reason=forbidden");
  });

  it("cs role → /dashboard/ops 접근 시 forbidden redirect", async () => {
    const jwt = mintJwt({ role: "cs", exp: nowSec() + 3600 });
    const req = makeRequest({
      url: "http://localhost:3000/dashboard/ops",
      cookie: jwt,
    });
    const res = (await middleware(req as unknown as Parameters<typeof middleware>[0])) as unknown as ResponseLike;
    expect(res.__type).toBe("redirect");
    expect(res.__url).toContain("reason=forbidden");
  });

  it("sre role → /dashboard/ops 접근 통과", async () => {
    const jwt = mintJwt({ role: "sre", exp: nowSec() + 3600 });
    const req = makeRequest({
      url: "http://localhost:3000/dashboard/ops",
      cookie: jwt,
    });
    const res = (await middleware(req as unknown as Parameters<typeof middleware>[0])) as unknown as ResponseLike;
    expect(res.__type).toBe("next");
  });

  it("superadmin → 모든 매트릭스 경로 통과 (operators 포함)", async () => {
    const jwt = mintJwt({ role: "superadmin", exp: nowSec() + 3600 });
    const paths = [
      "/dashboard",
      "/dashboard/operators",
      "/dashboard/ip-allowlist",
      "/dashboard/ops",
      "/dashboard/ota",
      "/dashboard/users",
    ];
    for (const p of paths) {
      const req = makeRequest({ url: `http://localhost:3000${p}`, cookie: jwt });
      const res = (await middleware(req as unknown as Parameters<typeof middleware>[0])) as unknown as ResponseLike;
      expect(res.__type).toBe("next");
    }
  });

  it("role 누락 JWT → 보수적으로 viewer 취급 → operators 차단", async () => {
    const jwt = mintJwt({ exp: nowSec() + 3600 });
    const req = makeRequest({
      url: "http://localhost:3000/dashboard/operators",
      cookie: jwt,
    });
    const res = (await middleware(req as unknown as Parameters<typeof middleware>[0])) as unknown as ResponseLike;
    expect(res.__type).toBe("redirect");
    expect(res.__url).toContain("reason=forbidden");
  });
});

describe("middleware — Silent refresh (#1 보조)", () => {
  it("ICONIA_SERVER_URL 미설정 — refresh 시도 없이 그대로 통과", async () => {
    // exp 가 임박해도 server URL 이 없으면 refresh skip → 본 요청 통과.
    const jwt = mintJwt({ role: "superadmin", exp: nowSec() + 60 });
    const req = makeRequest({
      url: "http://localhost:3000/dashboard",
      cookie: jwt,
    });
    const res = (await middleware(req as unknown as Parameters<typeof middleware>[0])) as unknown as ResponseLike;
    expect(res.__type).toBe("next");
  });
});
