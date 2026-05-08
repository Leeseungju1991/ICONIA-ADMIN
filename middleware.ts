import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE_NAME } from "./lib/authCookie";

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get(AUTH_COOKIE_NAME);
  if (!cookie) {
    const url = new URL("/login", req.url);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*"],
};
