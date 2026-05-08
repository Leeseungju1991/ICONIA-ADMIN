import { redirect } from "next/navigation";
import { readSession, clearSession } from "@/lib/authCookie";
import { readIdentityFromJwt } from "@/lib/identity";
import { LogoutButton } from "@/app/components/LogoutButton";

export const dynamic = "force-dynamic";

export default function DashboardPage() {
  const jwt = readSession();
  if (!jwt) {
    redirect("/login");
  }

  const identity = readIdentityFromJwt(jwt!);
  if (!identity) {
    clearSession();
    redirect("/login?reason=invalid");
  }

  return (
    <main className="dashboard">
      <header>
        <div>
          <strong>ICONIA Admin</strong>
          <div className="who">{identity!.email}</div>
        </div>
        <LogoutButton />
      </header>

      <section>
        <h2>대시보드</h2>
        <ul style={{ paddingLeft: 18, lineHeight: 2 }}>
          <li>
            <a href="/dashboard/users">사용자 검색 + 상세</a> — Round 2 (배포됨)
          </li>
          <li style={{ color: "var(--muted)" }}>
            Devices / Firmware / Reports / Audit / SRE — 다음 라운드 예정
          </li>
        </ul>
      </section>
    </main>
  );
}
