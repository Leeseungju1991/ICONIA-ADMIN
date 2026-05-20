import { redirect } from "next/navigation";
import { type ReactNode } from "react";
import { readSession } from "@/lib/authCookie";
import { decodeJwtPayloadUnsafe } from "@/lib/jwt";

// P0 보안 정상화 (2026-05-19):
//   - localStorage 의존 제거 → Server Component 에서 httpOnly cookie 직접 확인.
//   - middleware.ts 가 1차 차단하지만, dashboard layout 에서도 redirect → 이중 방어.
//   - JWT exp 가 과거이면 /login?reason=expired 로 redirect.
//
// 경로별 RBAC 강제는 middleware.ts (edge) 가 수행 — JWT role 클레임 + PATH_REQUIRED_ROLES.

export default function RequireAuth({ children }: { children: ReactNode }) {
  const jwt = readSession();
  if (!jwt) {
    redirect("/login?reason=missing");
  }

  const payload = decodeJwtPayloadUnsafe(jwt);
  const exp = typeof payload?.exp === "number" ? payload.exp : null;
  if (exp !== null) {
    const nowSec = Math.floor(Date.now() / 1000);
    if (exp <= nowSec) {
      redirect("/login?reason=expired");
    }
  }

  return <>{children}</>;
}
