import Link from "next/link";
import { readSession } from "@/lib/authCookie";
import { listDevices, type DeviceRow } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

function StatusBadge({ status, online }: { status: string; online: boolean }) {
  if (status === "lost") return <span className="badge err">분실신고</span>;
  if (status === "unpaired") return <span className="badge muted">미페어링</span>;
  if (status === "archived") return <span className="badge muted">아카이브</span>;
  return online ? <span className="badge ok">온라인</span> : <span className="badge warn">오프라인</span>;
}

export default async function DevicesPage({
  searchParams,
}: {
  searchParams: { q?: string; status?: string };
}) {
  const jwt = readSession()!;
  const res = await listDevices({
    jwt,
    query: searchParams.q,
    status: searchParams.status,
    limit: 50,
  });

  return (
    <div className="page">
      <h1>디바이스</h1>
      <p className="muted">인형/디바이스 링크 목록. 검색, 상태 필터, 강제 언페어링, 분실 신고.</p>

      <form className="toolbar">
        <input type="text" name="q" placeholder="serial / device_id / user email" defaultValue={searchParams.q ?? ""} />
        <select name="status" defaultValue={searchParams.status ?? ""}>
          <option value="">전체</option>
          <option value="active">active</option>
          <option value="unpaired">unpaired</option>
          <option value="lost">lost</option>
          <option value="archived">archived</option>
        </select>
        <button className="btn small" type="submit">검색</button>
      </form>

      {!res.ok ? (
        <div className="error" role="alert">{messageForCode(res.code, res.message)}</div>
      ) : res.data.items.length === 0 ? (
        <div className="empty">결과 없음</div>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th>device_id</th>
              <th>serial</th>
              <th>FW</th>
              <th>HW</th>
              <th>battery</th>
              <th>last_seen</th>
              <th>status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {res.data.items.map((d: DeviceRow) => (
              <tr key={d.device_id}>
                <td><code>{d.device_id.slice(0, 12)}…</code></td>
                <td>{d.serial ?? "—"}</td>
                <td>{d.firmware_version ?? "—"}</td>
                <td>{d.hardware_revision ?? "—"}</td>
                <td>{d.last_battery_percent != null ? `${d.last_battery_percent}%` : "—"}</td>
                <td>{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString("ko-KR") : "—"}</td>
                <td><StatusBadge status={d.status} online={d.online} /></td>
                <td className="cell-actions">
                  <Link className="btn small secondary" href={`/dashboard/devices/${encodeURIComponent(d.device_id)}`}>상세</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
