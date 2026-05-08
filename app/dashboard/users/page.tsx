import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession, clearSession } from "@/lib/authCookie";
import { searchUsers } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";
import { LogoutButton } from "@/app/components/LogoutButton";

export const dynamic = "force-dynamic";

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ko-KR");
}

export default async function UsersSearchPage({
  searchParams,
}: {
  searchParams: { email?: string };
}) {
  const jwt = readSession();
  if (!jwt) redirect("/login");

  const query = (searchParams?.email || "").trim();
  let users: Awaited<ReturnType<typeof searchUsers>>["ok"] extends true
    ? never
    : never;

  let result = null as
    | Awaited<ReturnType<typeof searchUsers>>
    | null;
  if (query) {
    result = await searchUsers({ jwt: jwt!, email: query, limit: 50 });
    if (
      !result.ok &&
      (result.code === "ERR_OPERATOR_AUTH_EXPIRED" ||
        result.code === "ERR_OPERATOR_AUTH_INVALID")
    ) {
      clearSession();
      redirect(
        `/login?reason=${result.code === "ERR_OPERATOR_AUTH_EXPIRED" ? "expired" : "invalid"}`,
      );
    }
  }

  return (
    <main className="dashboard">
      <header>
        <div>
          <strong>ICONIA Admin</strong>
          <div className="who">
            <Link href="/dashboard">대시보드</Link> · 사용자 검색
          </div>
        </div>
        <LogoutButton />
      </header>

      <section style={{ marginBottom: 20 }}>
        <form action="/dashboard/users" method="get">
          <div className="form-row">
            <label htmlFor="email">이메일 또는 일부 (예: alice 또는 @example.com)</label>
            <input
              id="email"
              name="email"
              type="text"
              defaultValue={query}
              placeholder="alice"
              autoFocus
            />
          </div>
          <button className="btn" type="submit" style={{ width: "auto" }}>
            검색
          </button>
        </form>
      </section>

      {result && !result.ok ? (
        <div className="error" role="alert">
          {messageForCode(result.code)}
        </div>
      ) : null}

      {result && result.ok ? (
        <section>
          <h2 style={{ marginBottom: 8 }}>
            결과 ({result.data.users.length}건)
          </h2>
          {result.data.users.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>일치하는 사용자가 없습니다.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--muted)", fontSize: 13 }}>
                  <th style={{ padding: "8px 4px", borderBottom: "1px solid var(--border)" }}>이메일</th>
                  <th style={{ padding: "8px 4px", borderBottom: "1px solid var(--border)" }}>상태</th>
                  <th style={{ padding: "8px 4px", borderBottom: "1px solid var(--border)" }}>TOTP</th>
                  <th style={{ padding: "8px 4px", borderBottom: "1px solid var(--border)" }}>가입일</th>
                  <th style={{ padding: "8px 4px", borderBottom: "1px solid var(--border)" }}>액션</th>
                </tr>
              </thead>
              <tbody>
                {result.data.users.map((u) => (
                  <tr key={u.id}>
                    <td style={{ padding: "10px 4px", borderBottom: "1px solid var(--border)" }}>
                      {u.email}
                    </td>
                    <td style={{ padding: "10px 4px", borderBottom: "1px solid var(--border)" }}>
                      {u.account_status ?? "—"}
                    </td>
                    <td style={{ padding: "10px 4px", borderBottom: "1px solid var(--border)" }}>
                      {u.totp_enabled ? "✓" : "—"}
                    </td>
                    <td style={{ padding: "10px 4px", borderBottom: "1px solid var(--border)", color: "var(--muted)", fontSize: 13 }}>
                      {fmt(u.created_at)}
                    </td>
                    <td style={{ padding: "10px 4px", borderBottom: "1px solid var(--border)" }}>
                      <Link href={`/dashboard/users/${u.id}`}>상세</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ) : null}
    </main>
  );
}
