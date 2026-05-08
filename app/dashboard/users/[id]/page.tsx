import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession, clearSession } from "@/lib/authCookie";
import { getUserDetail } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";
import { LogoutButton } from "@/app/components/LogoutButton";
import { ForceLogoutButton } from "@/app/components/ForceLogoutButton";

export const dynamic = "force-dynamic";

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ko-KR");
}

export default async function UserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const jwt = readSession();
  if (!jwt) redirect("/login");

  const result = await getUserDetail({ jwt: jwt!, userId: params.id });

  if (!result.ok) {
    if (
      result.code === "ERR_OPERATOR_AUTH_EXPIRED" ||
      result.code === "ERR_OPERATOR_AUTH_INVALID"
    ) {
      clearSession();
      redirect(
        `/login?reason=${result.code === "ERR_OPERATOR_AUTH_EXPIRED" ? "expired" : "invalid"}`,
      );
    }
    return (
      <main className="dashboard">
        <header>
          <div>
            <strong>ICONIA Admin</strong>
            <div className="who">
              <Link href="/dashboard/users">← 사용자 검색</Link>
            </div>
          </div>
          <LogoutButton />
        </header>
        <section>
          <div className="error" role="alert">
            {messageForCode(result.code)}
          </div>
        </section>
      </main>
    );
  }

  const { user, active_session_count } = result.data;

  return (
    <main className="dashboard">
      <header>
        <div>
          <strong>ICONIA Admin</strong>
          <div className="who">
            <Link href="/dashboard/users">← 사용자 검색</Link>
          </div>
        </div>
        <LogoutButton />
      </header>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ marginTop: 0 }}>{user.email}</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <tbody>
            <Row label="ID">
              <code>{user.id}</code>
            </Row>
            <Row label="상태">{user.account_status ?? "—"}</Row>
            <Row label="TOTP 활성">{user.totp_enabled ? "✓ 활성" : "—"}</Row>
            <Row label="paused_at">{fmt(user.paused_at)}</Row>
            <Row label="pending_deletion_at">
              {fmt(user.pending_deletion_at)}
            </Row>
            <Row label="가입일">{fmt(user.created_at)}</Row>
            <Row label="최근 로그인">{fmt(user.last_login_at)}</Row>
            <Row label="활성 세션">{active_session_count}</Row>
          </tbody>
        </table>
      </section>

      <section>
        <h3 style={{ marginBottom: 8 }}>운영 액션</h3>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 12 }}>
          {active_session_count > 0
            ? `현재 ${active_session_count}개 active session — 강제 로그아웃 시 모두 revoke 됩니다.`
            : "활성 세션이 없습니다."}
        </p>
        <ForceLogoutButton userId={user.id} />
      </section>
    </main>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td
        style={{
          padding: "8px 4px",
          color: "var(--muted)",
          width: 180,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {label}
      </td>
      <td style={{ padding: "8px 4px", borderBottom: "1px solid var(--border)" }}>
        {children}
      </td>
    </tr>
  );
}
