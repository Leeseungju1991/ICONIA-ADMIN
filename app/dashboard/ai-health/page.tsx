import { readSession } from "@/lib/authCookie";
import { getAiHealth } from "@/lib/adminApi";

export const dynamic = "force-dynamic";

export default async function AiHealthPage() {
  const jwt = readSession()!;
  const res = await getAiHealth({ jwt });

  return (
    <div className="page">
      <h1>AI 상태</h1>
      <p className="muted">5분 sliding window 기준 fallback rate / latency / error code 분포.</p>

      {!res.ok ? (
        <div className="error">{res.code}: {res.message}</div>
      ) : (
        <>
          <div className="tiles">
            <div className="tile">
              <div className="tile-label">total calls</div>
              <div className="tile-value">{res.data.total_calls}</div>
              <div className="tile-sub">window {res.data.window_seconds}s</div>
            </div>
            <div className="tile">
              <div className="tile-label">fallback rate</div>
              <div className="tile-value" style={{ color: res.data.fallback_rate > 0.1 ? "var(--error-fg)" : "inherit" }}>
                {(res.data.fallback_rate * 100).toFixed(2)}%
              </div>
              <div className="tile-sub">{res.data.fallback_count} fallback</div>
            </div>
            <div className="tile">
              <div className="tile-label">p95 latency</div>
              <div className="tile-value">{res.data.p95_latency_ms ?? "—"}<span style={{ fontSize: 14, color: "var(--muted)" }}> ms</span></div>
              <div className="tile-sub">p50 {res.data.p50_latency_ms ?? "—"} ms</div>
            </div>
          </div>

          <h2>error codes</h2>
          {res.data.errors.length === 0 ? (
            <div className="empty">이 구간 에러 없음</div>
          ) : (
            <table className="list">
              <thead><tr><th>code</th><th>count</th></tr></thead>
              <tbody>
                {res.data.errors.map((e) => (
                  <tr key={e.code}>
                    <td><code>{e.code}</code></td>
                    <td>{e.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="muted" style={{ marginTop: 16, fontSize: 12 }}>
            last_updated_at: {res.data.last_updated_at}
          </p>
        </>
      )}
    </div>
  );
}
