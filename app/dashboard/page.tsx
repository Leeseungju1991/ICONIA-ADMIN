import { readSession } from "@/lib/authCookie";
import { getAiHealth, listDevices } from "@/lib/adminApi";

// Dashboard overview — thin tile grid that calls a few cheap admin
// endpoints and surfaces health at a glance. Failures render as "—".

export const dynamic = "force-dynamic";

async function safeAiHealth(jwt: string) {
  const res = await getAiHealth({ jwt });
  return res.ok ? res.data : null;
}
async function safeDevicesCount(jwt: string) {
  const res = await listDevices({ jwt, limit: 1 });
  return res.ok ? res.data.items.length : null;
}

export default async function DashboardHome() {
  const jwt = readSession()!;
  const [aiHealth, devicesProbe] = await Promise.all([
    safeAiHealth(jwt),
    safeDevicesCount(jwt),
  ]);

  return (
    <div className="page">
      <h1>개요</h1>
      <p className="muted">AI 운영 현황 요약. 좌측 내비게이션에서 세부 페이지로 이동.</p>

      <div className="tiles">
        <div className="tile">
          <div className="tile-label">AI fallback rate (5분)</div>
          <div className="tile-value">
            {aiHealth ? `${(aiHealth.fallback_rate * 100).toFixed(1)}%` : "—"}
          </div>
          <div className="tile-sub">
            {aiHealth ? `${aiHealth.total_calls} calls / ${aiHealth.fallback_count} fallback` : "데이터 없음"}
          </div>
        </div>

        <div className="tile">
          <div className="tile-label">AI p95 latency</div>
          <div className="tile-value">
            {aiHealth?.p95_latency_ms != null ? `${aiHealth.p95_latency_ms} ms` : "—"}
          </div>
          <div className="tile-sub">{aiHealth?.last_updated_at ?? "—"}</div>
        </div>

        <div className="tile">
          <div className="tile-label">디바이스 API</div>
          <div className="tile-value">{devicesProbe === null ? "—" : "OK"}</div>
          <div className="tile-sub">/api/v1/admin/devices</div>
        </div>
      </div>

      <h2 style={{ marginTop: 32 }}>빠른 이동</h2>
      <ul className="link-list">
        <li><a href="/dashboard/users">사용자 검색</a></li>
        <li><a href="/dashboard/devices">디바이스 목록</a></li>
        <li><a href="/dashboard/firmware">펌웨어 배포 상태</a></li>
        <li><a href="/dashboard/posts">대기 중인 신고 게시물</a></li>
        <li><a href="/dashboard/commerce/orders">최근 주문</a></li>
        <li><a href="/dashboard/commerce/webhooks?only_failures=1">실패한 웹훅 이벤트</a></li>
      </ul>
    </div>
  );
}
