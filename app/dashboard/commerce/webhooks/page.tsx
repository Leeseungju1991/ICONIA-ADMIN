import { readSession } from "@/lib/authCookie";
import { listWebhookEvents, type WebhookEventRow } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: { cursor?: string; only_failures?: string };
}) {
  const jwt = readSession()!;
  const onlyFailures = searchParams.only_failures === "1";
  const res = await listWebhookEvents({
    jwt,
    cursor: searchParams.cursor,
    onlyFailures,
    limit: 50,
  });

  return (
    <div className="page">
      <h1>WooCommerce 웹훅</h1>
      <p className="muted">
        WP에서 수신된 webhook 이벤트 로그. delivery_id 기준 중복 차단,
        HMAC-SHA256 서명 검증 통과 일령에만 처리. processed=false 는 재시도 대상.
      </p>

      <form className="toolbar">
        <label>
          <input
            type="checkbox"
            name="only_failures"
            value="1"
            defaultChecked={onlyFailures}
          />{" "}
          실패만
        </label>
        <button className="btn small" type="submit">적용</button>
      </form>

      {!res.ok ? (
        <div className="error" role="alert">{messageForCode(res.code, res.message)}</div>
      ) : res.data.items.length === 0 ? (
        <div className="empty">이벤트 없음</div>
      ) : (
        <>
          <table className="list">
            <thead>
              <tr>
                <th>delivery_id</th>
                <th>topic</th>
                <th>resource / event</th>
                <th>processed</th>
                <th>failure</th>
                <th>received</th>
                <th>processed_at</th>
              </tr>
            </thead>
            <tbody>
              {res.data.items.map((e: WebhookEventRow) => (
                <tr key={e.id}>
                  <td><code style={{ fontSize: 11 }}>{e.delivery_id.slice(0, 12)}…</code></td>
                  <td>{e.topic}</td>
                  <td>{e.resource}.{e.event}</td>
                  <td>{e.processed ? <span className="badge ok">OK</span> : <span className="badge err">FAIL</span>}</td>
                  <td style={{ maxWidth: 280, color: "var(--error-fg)", fontSize: 12 }}>
                    {e.failure_reason ?? ""}
                  </td>
                  <td>{new Date(e.created_at).toLocaleString("ko-KR")}</td>
                  <td>{e.processed_at ? new Date(e.processed_at).toLocaleString("ko-KR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {res.data.next_cursor && (
            <p style={{ marginTop: 12 }}>
              <a href={`?cursor=${encodeURIComponent(res.data.next_cursor)}${onlyFailures ? "&only_failures=1" : ""}`}>
                다음 몇 건 →
              </a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
