import { NextResponse, type NextRequest } from "next/server";

// ICONIA Admin — Edge middleware (P0 보안 정상화 2026-05-19)
//
// 목적: SSR 진입 자체를 차단 → 첫 페인트 전에 인증 보장.
//   - `iconia_admin_session` httpOnly cookie 가 없거나, JWT exp 가 과거이면
//     /login?reason=expired 로 redirect.
//   - 본 middleware 는 cookie *존재* + JWT exp 클레임만 본다 (서명 검증은 Server).
//   - matcher 는 /dashboard, /admin 경로만 — /login, /_next, /api 는 통과.

import { AUTH_COOKIE_NAME } from "./lib/authCookie";

function decodeExpClaim(jwt: string): number | null {
  const parts = jwt.split(".");
  if (parts.length !== 3) return null;
  try {
    const padded =
      parts[1].replace(/-/g, "+").replace(/_/g, "/") +
      "===".slice((parts[1].length + 3) % 4);
    // Edge runtime 은 Buffer 가 없을 수 있어 atob 사용.
    const json =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("utf8");
    const payload = JSON.parse(json) as { exp?: unknown };
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

export function middleware(req: NextRequest) {
  const jwt = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!jwt) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?reason=missing";
    return NextResponse.redirect(url);
  }

  const exp = decodeExpClaim(jwt);
  if (exp !== null) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp <= nowSec) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "?reason=expired";
      const res = NextResponse.redirect(url);
      // 만료된 cookie 제거 (서버 응답으로 cleared) — 다음 요청에서 missing 분기.
      res.cookies.delete(AUTH_COOKIE_NAME);
      return res;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/security/:path*"],
};
