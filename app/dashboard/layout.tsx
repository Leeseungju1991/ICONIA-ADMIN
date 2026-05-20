import RequireAuth from "@/app/components/RequireAuth";
import { loadIconiaEnv } from "@/lib/env";
import Sidebar from "./Sidebar";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 운영자가 prod/staging/dev 콘솔을 시각적으로 즉시 구분 — 출시준비 라운드 §4 (env 배지).
  // 서버 컴포넌트에서 env 를 결정해 Sidebar (client) 에 prop 으로 주입한다.
  const env = loadIconiaEnv();
  return (
    <RequireAuth>
      <Sidebar env={env}>{children}</Sidebar>
    </RequireAuth>
  );
}
