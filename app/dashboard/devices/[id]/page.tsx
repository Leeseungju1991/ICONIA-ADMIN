import Link from "next/link";
import { readSession } from "@/lib/authCookie";
import { getDeviceDetail } from "@/lib/adminApi";
import { forceUnpairAction, markLostAction } from "@/lib/actions/devices";
import { ConfirmActionForm } from "@/app/components/ConfirmActionForm";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

export default async function DeviceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const jwt = readSession()!;
  const res = await getDeviceDetail({ jwt, deviceId: params.id });

  if (!res.ok) {
    return (
      <div className="page">
        <h1>디바이스 상세</h1>
        <div className="error" role="alert">{messageForCode(res.code, res.message)}</div>
        <Link href="/dashboard/devices">← 목록</Link>
      </div>
    );
  }

  const d = res.data.device;

  return (
    <div className="page">
      <Link href="/dashboard/devices">← 목록</Link>
      <h1 style={{ marginTop: 12 }}>{d.serial ?? d.device_id}</h1>
      <p className="muted">device_id: <code>{d.device_id}</code></p>

      <h2>기본 정보</h2>
      <table className="list">
        <tbody>
          <tr><td className="muted">user_id</td><td><code>{d.user_id ?? "—"}</code></td></tr>
          <tr><td className="muted">firmware</td><td>{d.firmware_version ?? "—"}</td></tr>
          <tr><td className="muted">hardware</td><td>{d.hardware_revision ?? "—"}</td></tr>
          <tr><td className="muted">battery</td><td>{d.last_battery_percent != null ? `${d.last_battery_percent}%` : "—"}</td></tr>
          <tr><td className="muted">last_seen</td><td>{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString("ko-KR") : "—"}</td></tr>
          <tr><td className="muted">paired</td><td>{d.paired_at ? new Date(d.paired_at).toLocaleString("ko-KR") : "—"}</td></tr>
          <tr><td className="muted">status</td><td>{d.status}{d.online ? " / online" : " / offline"}</td></tr>
        </tbody>
      </table>

      <h2>OTA 이력</h2>
      {res.data.ota_history && res.data.ota_history.length > 0 ? (
        <table className="list">
          <thead><tr><th>version</th><th>result</th><th>at</th></tr></thead>
          <tbody>
            {res.data.ota_history.map((h, i) => (
              <tr key={`${h.version}-${i}`}>
                <td>{h.version}</td>
                <td>{h.result}</td>
                <td>{new Date(h.at).toLocaleString("ko-KR")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="empty">OTA 시도 기록 없음</div>
      )}

      <h2>운영 액션</h2>
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {/* 강제 언페어링 — ConfirmActionForm 으로 5자 이상 사유 강제 (P0 §5.1.10b / 감사 §2.14). */}
        <div className="card" style={{ maxWidth: 360 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>강제 언페어링</h3>
          <p className="muted" style={{ fontSize: 12 }}>
            사용자 키 + 디바이스 세션을 모두 무효화합니다. 이중 확인 + 사유 입력 필요.
          </p>
          <ConfirmActionForm
            action={forceUnpairAction}
            hidden={{ device_id: d.device_id }}
            confirmMessage={`디바이스 ${d.serial ?? d.device_id} 의 페어링을 강제로 해제하시겠어요?\n\n사용자 키 + 디바이스 세션이 모두 무효화됩니다.`}
            reasonRequired
            buttonLabel="강제 언페어링"
            buttonClassName="btn full danger"
          />
        </div>

        <form action={markLostAction} className="card" style={{ maxWidth: 360 }}>
          <h3 style={{ marginTop: 0, fontSize: 15 }}>분실 표시</h3>
          <p className="muted" style={{ fontSize: 12 }}>
            사용자 CS 접수 후 디바이스를 lost 상태로 이전.
          </p>
          <input type="hidden" name="device_id" value={d.device_id} />
          <div className="form-row">
            <label>note (선택)</label>
            <input type="text" name="note" placeholder="CS 티켓 번호 등" />
          </div>
          <button className="btn full secondary" type="submit">분실 표시</button>
        </form>
      </div>
    </div>
  );
}
