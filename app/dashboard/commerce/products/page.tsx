import { readSession } from "@/lib/authCookie";
import { listProducts, type ProductRow } from "@/lib/adminApi";
import { syncProductsAction, syncCategoriesAction } from "@/lib/actions/commerce";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { cursor?: string };
}) {
  const jwt = readSession()!;
  const res = await listProducts({
    jwt,
    cursor: searchParams.cursor,
    limit: 50,
  });

  return (
    <div className="page">
      <h1>상품 (WordPress 동기화)</h1>
      <p className="muted">WooCommerce 로부터 동기화된 상품 캐시. 결제는 WP에서 처리되며 본 화면은 카탈로그 조회 용도.</p>

      <div className="toolbar">
        <form action={syncProductsAction}>
          <button className="btn small" type="submit">상품 동기화</button>
        </form>
        <form action={syncCategoriesAction}>
          <button className="btn small secondary" type="submit">카테고리 동기화</button>
        </form>
      </div>

      {!res.ok ? (
        <div className="error" role="alert">{messageForCode(res.code, res.message)}</div>
      ) : res.data.items.length === 0 ? (
        <div className="empty">동기화된 상품 없음. 상단 &ldquo;상품 동기화&rdquo; 버튼.</div>
      ) : (
        <>
          <table className="list">
            <thead>
              <tr>
                <th></th>
                <th>SKU / slug</th>
                <th>이름</th>
                <th>가격</th>
                <th>재고</th>
                <th>doll</th>
                <th>status</th>
                <th>synced_at</th>
              </tr>
            </thead>
            <tbody>
              {res.data.items.map((p: ProductRow) => (
                <tr key={p.id}>
                  <td>
                    {p.primary_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.primary_image} alt={p.name} width={40} height={40}
                           style={{ objectFit: "cover", borderRadius: 4 }} />
                    ) : null}
                  </td>
                  <td>
                    <div><code style={{ fontSize: 12 }}>{p.sku ?? "—"}</code></div>
                    <div className="muted" style={{ fontSize: 11 }}>{p.slug}</div>
                  </td>
                  <td>
                    <div>{p.name}</div>
                    {p.permalink ? (
                      <a href={p.permalink} target="_blank" rel="noreferrer" style={{ fontSize: 11 }}>WP 열기 ↗</a>
                    ) : null}
                  </td>
                  <td>{p.price} {p.currency}</td>
                  <td>{p.stock_quantity != null ? p.stock_quantity : <span className="muted">{p.stock_status}</span>}</td>
                  <td>{p.doll_related ? <span className="badge ok">doll</span> : null}</td>
                  <td>{p.status === "active" ? <span className="badge ok">{p.status}</span> : <span className="badge muted">{p.status}</span>}</td>
                  <td>{new Date(p.synced_at).toLocaleString("ko-KR")}</td>
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
