import Link from "next/link";
import { redirect } from "next/navigation";
import { readSession, clearSession } from "@/lib/authCookie";
import { searchUsers } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";

// 본 페이지는 app/dashboard/layout.tsx 의 사이드바 셸 안에서 렌더된다 — 자체 header/brand/LogoutButton
// 을 두지 않고 형제 dashboard 페이지들과 동일한 `<div className="page"><h1>…</h1>` 컨벤션을 따른다.
// (IMPLEMENTATION_BACKLOG §7.5 — Users 페이지 legacy no-sidebar 셸 → dashboard 셸 통일.)
export const dynamic = "force-dynamic";

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ko-KR");
}

// 페이지 단위 50건 — Server 의 GET /api/v1/admin/users 는 cursor 미지원
// (UsersList = { users, total }). 클라이언트 사이드 페이지네이션 fallback:
// limit=PAGE_SIZE*MAX_PAGES_FETCHED 로 한 번 받고 page=N 으로 slice.
// (P1 §5.2 #33 — 50건 limit 의 무한 noise 회복.)
const PAGE_SIZE = 50;
const MAX_PAGES_FETCHED = 10; // 한 번에 최대 500건만 client 메모리에 보관

export default async function UsersSearchPage({
  searchParams,
}: {
  searchParams: { email?: string; page?: string };
}) {
  const jwt = readSession();
  if (!jwt) redirect("/login");

  const query = (searchParams?.email || "").trim();
  const requestedPage = Math.max(1, Number.parseInt(searchParams?.page ?? "1", 10) || 1);

  let result = null as
    | Awaited<ReturnType<typeof searchUsers>>
    | null;
  if (query) {
    result = await searchUsers({
      jwt: jwt!,
      email: query,
      limit: PAGE_SIZE * MAX_PAGES_FETCHED,
    });
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

  // client-side pagination — Server cursor 미지원 시 fallback (#33).
  const allUsers = result && result.ok ? result.data.users : [];
  const totalPages = Math.max(1, Math.ceil(allUsers.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const sliceStart = (page - 1) * PAGE_SIZE;
  const pageUsers = allUsers.slice(sliceStart, sliceStart + PAGE_SIZE);
  const hasMore = page < totalPages;
  const hasPrev = page > 1;

  return (
    <div className="page">
      <h1>사용자 검색</h1>
      <p className="muted">이메일(또는 일부)로 사용자를 검색해 상태·TOTP·가입일을 확인하고 상세로 이동합니다.</p>

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
            결과 ({allUsers.length}건{allUsers.length >= PAGE_SIZE * MAX_PAGES_FETCHED ? "+" : ""})
          </h2>
          {allUsers.length === 0 ? (
            <p style={{ color: "var(--muted)" }}>일치하는 사용자가 없습니다.</p>
          ) : (
            <>
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                페이지 {page} / {totalPages} · 보기 {sliceStart + 1}–
                {sliceStart + pageUsers.length}
              </p>
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
                  {pageUsers.map((u) => (
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
              <nav
                aria-label="페이지네이션"
                style={{ display: "flex", gap: 16, marginTop: 16, fontSize: 14 }}
              >
                {hasPrev ? (
                  <Link
                    href={`?email=${encodeURIComponent(query)}&page=${page - 1}`}
                    rel="prev"
                  >
                    ← 이전
                  </Link>
                ) : (
                  <span style={{ color: "var(--muted)" }}>← 이전</span>
                )}
                {hasMore ? (
                  <Link
                    href={`?email=${encodeURIComponent(query)}&page=${page + 1}`}
                    rel="next"
                  >
                    다음 →
                  </Link>
                ) : (
                  <span style={{ color: "var(--muted)" }}>다음 →</span>
                )}
              </nav>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}
