import { readSession } from "@/lib/authCookie";
import { listOrders, type AdminOrderRow } from "@/lib/adminApi";
import { syncOrdersAction } from "@/lib/actions/commerce";

export const dynamic = "force-dynamic";

// IMPORTANT — 이 화면은 결제수단(payment_method), 거래아이디(transaction_id),
// 카드/은행 상세 등 민감 컴런을 일체 노출하지 않는다. 서버는 admin 호출 시
// 이 컬럼들을 projection 에서 제외해 내려주어야 한다. 이탈로 보이는 항목은
// status / item_count / total / customer_email / fulfilled_at 등 운영용 필드만.

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "completed": return <span className="badge ok">{status}</span>;
    case "processing": return <span className="badge ok">{status}</span>;
    case "on_hold": return <span className="badge warn">{status}</span>;
    case "pending": return <span className="badge muted">{status}</span>;
    case "cancelled": return <span className="badge err">{status}</span>;
    case "refunded": return <span className="badge err">{status}</span>;
    case "failed": return <span className="badge err">{status}</span>;
    default: return <span className="badge muted">{status}</span>;
  }
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { cursor?: string; status?: string };
}) {
  const jwt = readSession()!;
  const res = await listOrders({
    jwt,
    cursor: searchParams.cursor,
    status: searchParams.status,
    limit: 50,
  });

  return (
    <div className="page">
      <h1>주문 (처리 상태 우선)</h1>
      <p className="muted">
        결제수단 / 거래 상세는 본 화면에서 노출하지 않습니다 (PCI 책임 분리).
        환불/결제 조정은 WordPress / WooCommerce admin 에서 직접 처리.
      </p>

      <div className="toolbar">
        <form style={{ display: "contents" }}>
          <select name="status" defaultValue={searchParams.status ?? ""}>
            <option value="">전체 상태</option>
            <option value="pending">pending</option>
            <option value="processing">processing</option>
            <option value="on_hold">on_hold</option>
            <option value="completed">completed</option>
            <option value="cancelled">cancelled</option>
            <option value="refunded">refunded</option>
            <option value="failed">failed</option>
          </select>
          <button className="btn small" type="submit">필터</button>
        </form>
        <form action={syncOrdersAction} style={{ marginLeft: "auto" }}>
          <button className="btn small secondary" type="submit">WP에서 주문 동기화</button>
        </form>
      </div>

      {!res.ok ? (
        <div className="error">{res.code}: {res.message}</div>
      ) : res.data.items.length === 0 ? (
        <div className="empty">주문 없음</div>
      ) : (
        <>
          <table className="list">
            <thead>
              <tr>
                <th>order</th>
                <th>woo_id</th>
                <th>customer</th>
                <th>items</th>
                <th>total</th>
                <th>status</th>
                <th>paid_at</th>
                <th>completed_at</th>
              </tr>
            </thead>
            <tbody>
              {res.data.items.map((o: AdminOrderRow) => (
                <tr key={o.id}>
                  <td><code>{o.id.slice(0, 8)}…</code></td>
                  <td>{o.woo_id ?? "—"}</td>
                  <td>{o.customer_email ?? <span className="muted">guest</span>}</td>
                  <td>{o.item_count}</td>
                  <td>{o.total_amount} {o.currency}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>{o.paid_at ? new Date(o.paid_at).toLocaleString("ko-KR") : "—"}</td>
                  <td>{o.completed_at ? new Date(o.completed_at).toLocaleString("ko-KR") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {res.data.next_cursor && (
            <p style={{ marginTop: 12 }}>
              <a href={`?cursor=${encodeURIComponent(res.data.next_cursor)}`}>다음 몇 건 →</a>
            </p>
          )}
        </>
      )}
    </div>
  );
}
