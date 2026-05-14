import { readSession } from "@/lib/authCookie";
import { listAuditLog, type AuditEntry } from "@/lib/auditApi";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

// Audit log 독립 조회 페이지.
// SOC2 / ISO27001 / PIPA: 운영자 행위 추적 필수.
// 권한: secops/sre/superadmin (middleware 도 차단, 서버도 차단).

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (outcome === "success") return <span className="badge ok">success</span>;
  if (outcome === "denied") return <span className="badge warn">denied</span>;
  if (outcome === "error") return <span className="badge err">error</span>;
  return <span className="badge muted">{outcome ?? "—"}</span>;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { action?: string; operator_id?: string; target_type?: string; since?: string; cursor?: string };
}) {
  const jwt = readSession()!;
  const res = await listAuditLog({
    jwt,
    action: searchParams.action,
    operatorId: searchParams.operator_id,
    targetType: searchParams.target_type,
    since: searchParams.since,
    cursor: searchParams.cursor,
    limit: 100,
  });

  return (
    <div className="page">
      <h1>Audit 로그</h1>
      <p className="muted">
        운영자 권한 행사 추적. 기본 24시간 구간. SOC2/ISO27001 요구. 명세서와 매쪽 해시(prev/current)가 함께 표시 — 변조 검출용.
      </p>

      <form className="toolbar">
        <input
          type="text"
          name="action"
          placeholder="action (예: device_unpaired)"
          defaultValue={searchParams.action ?? ""}
        />
        <input
          type="text"
          name="operator_id"
          placeholder="operator_id (UUID)"
          defaultValue={searchParams.operator_id ?? ""}
        />
        <input
          type="text"
          name="target_type"
          placeholder="target_type (예: device, feed_post)"
          defaultValue={searchParams.target_type ?? ""}
        />
        <input
          type="datetime-local"
          name="since"
          defaultValue={searchParams.since ?? ""}
        />
        <button className="btn small" type="submit">필터</button>
      </form>

      {!res.ok ? (
        <div className="error" role="alert">{messageForCode(res.code, res.message)}</div>
      ) : res.data.items.length === 0 ? (
        <div className="empty">조건에 맞는 기록 없음</div>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12 }}>
            since: <code>{res.data.since}</code> · 조회 {res.data.items.length}건
          </p>
          <table className="list">
            <thead>
              <tr>
                <th>seq</th>
                <th>action</th>
                <th>outcome</th>
                <th>operator</th>
                <th>role</th>
                <th>target</th>
                <th>ip</th>
                <th>created</th>
                <th>chain</th>
              </tr>
            </thead>
            <tbody>
              {res.data.items.map((row: AuditEntry) => (
                <tr key={row.id}>
                  <td><code style={{ fontSize: 11 }}>{row.sequence_no ?? "—"}</code></td>
                  <td><code style={{ fontSize: 11 }}>{row.action}</code></td>
                  <td><OutcomeBadge outcome={row.action_outcome} /></td>
                  <td><code style={{ fontSize: 11 }}>{row.operator_id ? row.operator_id.slice(0, 8) + "…" : "—"}</code></td>
                  <td><span className="badge muted">{row.operator_role ?? "—"}</span></td>
                  <td>
                    {row.target_resource_type ? (
                      <>
                        <span className="badge muted">{row.target_resource_type}</span>{" "}
                        <code style={{ fontSize: 11 }}>{row.target_resource_id ? row.target_resource_id.slice(0, 8) + "…" : "—"}</code>
                      </>
                    ) : "—"}
                  </td>
                  <td><code style={{ fontSize: 11 }}>{row.ip}</code></td>
                  <td>{new Date(row.created_at).toLocaleString("ko-KR")}</td>
                  <td><code style={{ fontSize: 10, color: "var(--muted)" }}>{row.prev_hash ?? "—"} → {row.current_hash ?? "—"}</code></td>
                </tr>
              ))}
            </tbody>
          </table>
          {res.data.next_cursor && (
            <p style={{ marginTop: 12 }}>
              <a href={`?cursor=${encodeURIComponent(res.data.next_cursor)}`}>다음 몇 건 →</a>
            </p>
          )}
          <p className="muted" style={{ marginTop: 24, fontSize: 11 }}>
            전체 chain 변조 검증은 서버 측 services/auditChainVerifier 를 링크 이벤트로 실행.
            본 화면의 prev/current hash prefix 는 각 row 감쇄 발견용 — 구조 이상을 올림.
          </p>
        </>
      )}
    </div>
  );
}
