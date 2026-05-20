import { NextResponse, type NextRequest } from "next/server";

// ICONIA Admin — Edge middleware (P0 보안 정상화 2026-05-19)
//
// 목적: SSR 진입 자체를 차단 → 첫 페인트 전에 인증 보장.
//   - `iconia_admin_session` httpOnly cookie 가 없거나, JWT exp 가 과거이면
//     /login?reason=expired 로 redirect.
//   - 본 middleware 는 cookie *존재* + JWT exp 클레임만 본다 (서명 검증은 Server).
//   - matcher 는 /dashboard, /admin 경로만 — /login, /_next, /api 는 통과.
//
// 상용 라운드 (2026-05-20) — RBAC 강제:
//   - JWT `role` 클레임 + PATH_REQUIRED_ROLES 매트릭스로 경로별 접근을 1차 차단.
//   - 권한 미달 시 /dashboard?reason=forbidden 로 redirect.
//   - 서버가 정본 — 이는 defense-in-depth UX 계층 (403 직격 대신 사전 차단).

import { AUTH_COOKIE_NAME } from "./lib/authCookie";
import { findRequiredRoles, roleAllowed } from "./lib/operatorRoles";

type JwtClaims = { exp?: unknown; role?: unknown };

function decodeJwtClaims(jwt: string): JwtClaims | null {
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
    return JSON.parse(json) as JwtClaims;
  } catch {
    return null;
  }
}

function redirectTo(req: NextRequest, pathname: string, search: string) {
  const url = req.nextUrl.clone();
  url.pathname = pathname;
  url.search = search;
  return NextResponse.redirect(url);
}

export function middleware(req: NextRequest) {
  const jwt = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!jwt) {
    return redirectTo(req, "/login", "?reason=missing");
  }

  const claims = decodeJwtClaims(jwt);
  const exp = typeof claims?.exp === "number" ? claims.exp : null;
  if (exp !== null) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp <= nowSec) {
      const res = redirectTo(req, "/login", "?reason=expired");
      // 만료된 cookie 제거 (서버 응답으로 cleared) — 다음 요청에서 missing 분기.
      res.cookies.delete(AUTH_COOKIE_NAME);
      return res;
    }
  }

  // RBAC — 경로별 필요 역할 검사. role 클레임이 없으면 보수적으로 viewer 취급.
  const required = findRequiredRoles(req.nextUrl.pathname);
  if (required) {
    const role = typeof claims?.role === "string" ? claims.role : "viewer";
    if (!roleAllowed(role, required)) {
      return redirectTo(req, "/dashboard", "?reason=forbidden");
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/security/:path*"],
};
