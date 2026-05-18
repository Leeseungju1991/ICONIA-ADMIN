import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import { readSession } from "@/lib/authCookie";
import { readIdentityFromJwt } from "@/lib/identity";
import { roleAllowed } from "@/lib/operatorRoles";
import { IdleTimer } from "@/app/components/IdleTimer";
import { loadIdleTimeoutMinutes } from "@/lib/env";
import { Sidebar, SIDEBAR_WIDTH } from "@/app/components/dashboard/Sidebar";
import { DashboardAppBar } from "@/app/components/dashboard/AppBar";
import { NAV_ITEMS } from "@/app/components/dashboard/navConfig";

// Dashboard layout — 다크 사이드바 + 투명 AppBar(브레드크럼) shell.
// Auth 검사는 middleware 도 하지만 layout 에서도 다시 — server-side fetch 시 identity 가
// 필요하고, role 기반 nav 숨김도 여기서.
//
// 주의: invalid identity 분기에서 clearSession() 호출하지 않는다 (working-copy 의도).
//       login 페이지로 redirect 만.

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jwt = readSession();
  if (!jwt) redirect("/login");

  const identity = readIdentityFromJwt(jwt);
  if (!identity) redirect("/login?reason=invalid");

  const visibleNav = NAV_ITEMS.filter(
    (n) => !n.allowedRoles || roleAllowed(identity.role, n.allowedRoles),
  );
  const idleTimeoutMinutes = loadIdleTimeoutMinutes();

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <Sidebar
        visibleNav={visibleNav}
        identity={{ email: identity.email ?? null, role: identity.role ?? null }}
      />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          ml: { md: `${SIDEBAR_WIDTH}px` },
          px: { xs: 2, sm: 3, md: 4 },
          py: { xs: 2, md: 3 },
          minWidth: 0,
        }}
      >
        <DashboardAppBar />
        <Box sx={{ pt: 1 }}>{children}</Box>
      </Box>
      <IdleTimer timeoutMinutes={idleTimeoutMinutes} />
    </Box>
  );
}
