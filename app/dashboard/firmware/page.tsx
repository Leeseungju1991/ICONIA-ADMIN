import { readSession } from "@/lib/authCookie";
import { listFirmware, type DeploymentRow, type FirmwareVersionRow } from "@/lib/adminApi";
import { pauseDeploymentAction, resumeDeploymentAction } from "@/lib/actions/firmware";

export const dynamic = "force-dynamic";

function DeploymentBadge({ state }: { state: string }) {
  switch (state) {
    case "completed": return <span className="badge ok">{state}</span>;
    case "rolling": return <span className="badge ok">{state}</span>;
    case "queued": return <span className="badge muted">{state}</span>;
    case "paused": return <span className="badge warn">{state}</span>;
    case "aborted": return <span className="badge err">{state}</span>;
    default: return <span className="badge muted">{state}</span>;
  }
}

export default async function FirmwarePage() {
  const jwt = readSession()!;
  const res = await listFirmware({ jwt });

  if (!res.ok) {
    return (
      <div className="page">
        <h1>펌웨어 배포</h1>
        <div className="error">{res.code}: {res.message}</div>
      </div>
    );
  }

  const { versions, deployments } = res.data;

  return (
    <div className="page">
      <h1>펌웨어 배포</h1>
      <p className="muted">서버 매니페스트 기준 펌웨어 버전 + 배포 이력. 일시정지 / 재개는 운영자 권한 필요.</p>

      <h2>버전</h2>
      {versions.length === 0 ? (
        <div className="empty">등록된 펌웨어 없음</div>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th>version</th><th>channel</th><th>released</th><th>size</th><th>sha256</th><th>notes</th>
            </tr>
          </thead>
          <tbody>
            {versions.map((v: FirmwareVersionRow) => (
              <tr key={`${v.channel}-${v.version}`}>
                <td><code>{v.version}</code></td>
                <td><span className="badge muted">{v.channel}</span></td>
                <td>{new Date(v.released_at).toLocaleString("ko-KR")}</td>
                <td>{v.size_bytes != null ? `${(v.size_bytes / 1024).toFixed(0)} KB` : "—"}</td>
                <td><code style={{ fontSize: 11 }}>{v.sha256 ? `${v.sha256.slice(0, 12)}…` : "—"}</code></td>
                <td>{v.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2>배포</h2>
      {deployments.length === 0 ? (
        <div className="empty">진행 중인 배포 없음</div>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th>id</th><th>version</th><th>cohort</th><th>state</th>
              <th>%</th><th>ok / fail</th><th>updated</th><th></th>
            </tr>
          </thead>
          <tbody>
            {deployments.map((d: DeploymentRow) => (
              <tr key={d.id}>
                <td><code>{d.id.slice(0, 8)}…</code></td>
                <td><code>{d.version}</code></td>
                <td><code>{d.cohort_id ? d.cohort_id.slice(0, 8) + "…" : "all"}</code></td>
                <td><DeploymentBadge state={d.state} /></td>
                <td>{d.rollout_percent}%</td>
                <td>{d.succeeded} / <span style={{ color: d.failed > 0 ? "var(--error-fg)" : "inherit" }}>{d.failed}</span></td>
                <td>{new Date(d.updated_at).toLocaleString("ko-KR")}</td>
                <td className="cell-actions">
                  {d.state === "rolling" || d.state === "queued" ? (
                    <form action={pauseDeploymentAction}>
                      <input type="hidden" name="deployment_id" value={d.id} />
                      <input type="hidden" name="reason" value="manual_pause" />
                      <button className="btn small secondary" type="submit">일시정지</button>
                    </form>
                  ) : d.state === "paused" ? (
                    <form action={resumeDeploymentAction}>
                      <input type="hidden" name="deployment_id" value={d.id} />
                      <button className="btn small" type="submit">재개</button>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
