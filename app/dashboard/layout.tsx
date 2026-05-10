import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession, clearSession } from "@/lib/authCookie";
import { readIdentityFromJwt } from "@/lib/identity";
import { roleAllowed, type OperatorRole } from "@/lib/operatorRoles";
import { LogoutButton } from "@/app/components/LogoutButton";

// Dashboard layout — 공유 사이드바 + auth 검사 for /dashboard/*.
// Auth 검사는 middleware 도 하지만 레이아웃에서도 다시 — server-side 데이터 fetch 시 identity가
// 필요하고, role 기반 네비 숨김도 여기서 처리.

export const dynamic = "force-dynamic";

type NavItem = { href: string; label: string; allowedRoles?: OperatorRole[] };
const NAV: NavItem[] = [
  { href: "/dashboard", label: "☰ 개요" },
  { href: "/dashboard/users", label: "사용자", allowedRoles: ["superadmin", "sre", "secops", "cs"] },
  { href: "/dashboard/devices", label: "디바이스", allowedRoles: ["superadmin", "sre", "secops"] },
  { href: "/dashboard/firmware", label: "펜웨어 배포", allowedRoles: ["superadmin", "sre", "secops"] },
  { href: "/dashboard/ai-health", label: "AI 상태" },
  { href: "/dashboard/posts", label: "게시물 모던" },
  { href: "/dashboard/audit", label: "⚱ Audit 로그", allowedRoles: ["superadmin", "sre", "secops"] },
  { href: "/dashboard/operators", label: "운영자", allowedRoles: ["superadmin"] },
  { href: "/dashboard/commerce/products", label: "— 상품" },
  { href: "/dashboard/commerce/orders", label: "— 주문" },
  { href: "/dashboard/commerce/webhooks", label: "— 웹훅" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const jwt = readSession();
  if (!jwt) redirect("/login");

  const identity = readIdentityFromJwt(jwt);
  if (!identity) {
    clearSession();
    redirect("/login?reason=invalid");
  }

  const visibleNav = NAV.filter((n) => !n.allowedRoles || roleAllowed(identity.role, n.allowedRoles));

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">ICONIA Admin</div>
        <nav>
          {visibleNav.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who">{identity.email}</div>
          {identity.role ? <div className="who" style={{ color: "var(--accent)" }}>{identity.role}</div> : null}
          <LogoutButton />
        </div>
      </aside>
      <section className="workspace">{children}</section>
    </main>
  );
}
