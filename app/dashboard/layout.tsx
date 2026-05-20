import RequireAuth from "@/app/components/RequireAuth";
import { loadIconiaEnv } from "@/lib/env";
import { readSession } from "@/lib/authCookie";
import { resolveIdentity } from "@/lib/identity";
import type { OperatorRole } from "@/lib/operatorRoles";
import Sidebar from "./Sidebar";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 운영자가 prod/staging/dev 콘솔을 시각적으로 즉시 구분 — 출시준비 라운드 §4 (env 배지).
  // 서버 컴포넌트에서 env 를 결정해 Sidebar (client) 에 prop 으로 주입한다.
  const env = loadIconiaEnv();

  // RBAC — 운영자 역할/이메일을 Server `/api/v1/operator/me` 로 서명검증 조회한다.
  // Server 도달 불가 시 JWT payload 로 graceful fallback (resolveIdentity 내부).
  // 경로별 강제 차단은 middleware.ts (edge) 가 1차로 수행 — 여기는 표시/네비 게이팅.
  const jwt = readSession();
  const identity = await resolveIdentity(jwt);
  const role: OperatorRole = identity?.role ?? "viewer";

  return (
    <RequireAuth>
      <Sidebar env={env} role={role} operatorEmail={identity?.email ?? null}>
        {children}
      </Sidebar>
    </RequireAuth>
  );
}
