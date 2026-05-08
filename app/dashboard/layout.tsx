import { redirect } from "next/navigation";
import Link from "next/link";
import { readSession, clearSession } from "@/lib/authCookie";
import { readIdentityFromJwt } from "@/lib/identity";
import { LogoutButton } from "@/app/components/LogoutButton";

// Dashboard layout — shared sidebar + auth check for /dashboard/*.
// Auth check duplicated here (not just in middleware) so server-side data
// fetches in child pages always have a valid identity.

export const dynamic = "force-dynamic";

type NavItem = { href: string; label: string };
const NAV: NavItem[] = [
  { href: "/dashboard", label: "☰ 개요" },
  { href: "/dashboard/users", label: "사용자" },
  { href: "/dashboard/devices", label: "디바이스" },
  { href: "/dashboard/firmware", label: "펜웨어 배포" },
  { href: "/dashboard/ai-health", label: "AI 상태" },
  { href: "/dashboard/posts", label: "게시물 모던" },
  { href: "/dashboard/operators", label: "운영자" },
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

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand">ICONIA Admin</div>
        <nav>
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="who">{identity.email}</div>
          <LogoutButton />
        </div>
      </aside>
      <section className="workspace">{children}</section>
    </main>
  );
}
