import RequireAuth from "@/app/components/RequireAuth";
import { loadIconiaEnv } from "@/lib/env";
import { readSession } from "@/lib/authCookie";
import { resolveIdentity } from "@/lib/identity";
import type { OperatorRole } from "@/lib/operatorRoles";
import { listReportsAction } from "@/lib/actions/reportsAdmin";
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

  // 2026-05-27 — 모더레이션 미해결 신고 카운트 (사이드바 배지 + 대시보드 강조용).
  // server 라우트 미가동 시 0 으로 graceful fallback (호출 자체가 안전).
  const reportsRes = await listReportsAction({ status: "open" });
  const moderationOpenCount = reportsRes.ok ? reportsRes.data.total_open : 0;

  return (
    <RequireAuth>
      <Sidebar
        env={env}
        role={role}
        operatorEmail={identity?.email ?? null}
        moderationOpenCount={moderationOpenCount}
      >
        {children}
      </Sidebar>
    </RequireAuth>
  );
}
