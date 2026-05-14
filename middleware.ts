import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "./lib/authCookie";
import { decodeJwtPayloadUnsafe } from "./lib/jwt";
import { findRequiredRoles, parseRoleFromJwtPayload, roleAllowed } from "./lib/operatorRoles";

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE_NAME);
  if (!cookie) {
    const url = new URL("/login", req.url);
    url.searchParams.set("reason", "no_session");
    return NextResponse.redirect(url);
  }

  // JWT exp 조기 검사 — 만료권은 server가 401 로 반환하지만, 명백한게 만료된 토큰으로 서버 호출하지
  // 않도록 /login 으로 조기 리다이렉트 — UX + 서버 부하 감소.
  const payload = decodeJwtPayloadUnsafe(cookie.value);
  if (!payload) {
    const url = new URL("/login", req.url);
    url.searchParams.set("reason", "invalid");
    return NextResponse.redirect(url);
  }
  const exp = typeof payload.exp === "number" ? payload.exp : null;
  if (exp != null && exp * 1000 < Date.now()) {
    const url = new URL("/login", req.url);
    url.searchParams.set("reason", "expired");
    const res = NextResponse.redirect(url);
    res.cookies.delete(AUTH_COOKIE_NAME);
    return res;
  }

  // Role-based path gating (서버 권한 증명 이외 애초 접근 차단 — defense in depth).
  // 서버가 403 을 반환하는 권한도 admin 포이지 렌더링 자체가 사전 차단되는 게 안전.
  const role = parseRoleFromJwtPayload(payload);
  const allowed = findRequiredRoles(req.nextUrl.pathname);
  if (allowed && !roleAllowed(role, allowed)) {
    const url = new URL("/dashboard", req.url);
    url.searchParams.set("reason", "forbidden");
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
