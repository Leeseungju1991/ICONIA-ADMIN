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
        <h2>대시보드 (placeholder)</h2>
        <p style={{ color: "var(--muted)" }}>
          Users / Devices / Firmware / Reports / Audit / SRE 화면은 다음
          라운드에서 노출됩니다.
        </p>
      </section>
    </main>
  );
}
