import Link from "next/link";
import { readSession } from "@/lib/authCookie";
import { listFirmware, type DeploymentRow, type FirmwareVersionRow } from "@/lib/adminApi";
import { pauseDeploymentAction, resumeDeploymentAction } from "@/lib/actions/firmware";
import { ConfirmActionForm } from "@/app/components/ConfirmActionForm";
import { DisabledActionButton } from "@/app/components/DisabledActionButton";
import { messageForCode } from "@/lib/errorMessages";
import { readIdentityFromJwt } from "@/lib/identity";

export const dynamic = "force-dynamic";

// 페이지 단위 50건 — Server 의 GET /api/v1/admin/firmware 는 cursor 미지원
// (FirmwareList = { versions, deployments } 전체 응답). 클라이언트 사이드 페이지네이션 fallback
// (P1 §5.2 #33 — 무한 deployment 리스트 회복).
const PAGE_SIZE = 50;

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

export default async function FirmwarePage({
  searchParams,
}: {
  searchParams: { vpage?: string; dpage?: string };
}) {
  const jwt = readSession()!;
  const identity = readIdentityFromJwt(jwt);
  // viewer 는 pause/resume mutating 액션 차단 (P2 round). 서버도 403 차단.
  const canMutate = identity?.role !== "viewer";
  const res = await listFirmware({ jwt });

  if (!res.ok) {
    return (
      <div className="page">
        <h1>펌웨어 배포</h1>
        <div className="error" role="alert">{messageForCode(res.code, res.message)}</div>
      </div>
    );
  }

  const { versions, deployments } = res.data;

  // client-side pagination — 버전/배포 각각 50건씩 (#33).
  const vTotalPages = Math.max(1, Math.ceil(versions.length / PAGE_SIZE));
  const vRequested = Math.max(1, Number.parseInt(searchParams?.vpage ?? "1", 10) || 1);
  const vPage = Math.min(vRequested, vTotalPages);
  const vSliceStart = (vPage - 1) * PAGE_SIZE;
  const versionsPage = versions.slice(vSliceStart, vSliceStart + PAGE_SIZE);
  const vHasPrev = vPage > 1;
  const vHasNext = vPage < vTotalPages;

  const dTotalPages = Math.max(1, Math.ceil(deployments.length / PAGE_SIZE));
  const dRequested = Math.max(1, Number.parseInt(searchParams?.dpage ?? "1", 10) || 1);
  const dPage = Math.min(dRequested, dTotalPages);
  const dSliceStart = (dPage - 1) * PAGE_SIZE;
  const deploymentsPage = deployments.slice(dSliceStart, dSliceStart + PAGE_SIZE);
  const dHasPrev = dPage > 1;
  const dHasNext = dPage < dTotalPages;

  return (
    <div className="page">
      <h1>펌웨어 배포</h1>
      <p className="muted">서버 매니페스트 기준 펌웨어 버전 + 배포 이력. 일시정지 / 재개는 운영자 권한 필요.</p>

      <h2>버전 ({versions.length}건)</h2>
      {versions.length === 0 ? (
        <div className="empty">등록된 펌웨어 없음</div>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12 }}>
            페이지 {vPage} / {vTotalPages} · 보기 {vSliceStart + 1}–{vSliceStart + versionsPage.length}
          </p>
          <table className="list">
            <thead>
              <tr>
                <th>version</th><th>channel</th><th>released</th><th>size</th><th>sha256</th><th>notes</th>
              </tr>
            </thead>
            <tbody>
              {versionsPage.map((v: FirmwareVersionRow) => (
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
          <nav aria-label="버전 페이지네이션" style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 14 }}>
            {vHasPrev ? (
              <Link href={`?vpage=${vPage - 1}&dpage=${dPage}`} rel="prev">← 이전</Link>
            ) : (
              <span className="muted">← 이전</span>
            )}
            {vHasNext ? (
              <Link href={`?vpage=${vPage + 1}&dpage=${dPage}`} rel="next">다음 →</Link>
            ) : (
              <span className="muted">다음 →</span>
            )}
          </nav>
        </>
      )}

      <h2>배포 ({deployments.length}건)</h2>
      {deployments.length === 0 ? (
        <div className="empty">진행 중인 배포 없음</div>
      ) : (
        <>
          <p className="muted" style={{ fontSize: 12 }}>
            페이지 {dPage} / {dTotalPages} · 보기 {dSliceStart + 1}–{dSliceStart + deploymentsPage.length}
          </p>
          <table className="list">
            <thead>
              <tr>
                <th>id</th><th>version</th><th>cohort</th><th>state</th>
                <th>%</th><th>ok / fail</th><th>updated</th><th></th>
              </tr>
            </thead>
            <tbody>
              {deploymentsPage.map((d: DeploymentRow) => (
              <tr key={d.id}>
                <td><code>{d.id.slice(0, 8)}…</code></td>
                <td><code>{d.version}</code></td>
                <td><code>{d.cohort_id ? d.cohort_id.slice(0, 8) + "…" : "all"}</code></td>
                <td><DeploymentBadge state={d.state} /></td>
                <td>{d.rollout_percent}%</td>
                <td>{d.succeeded} / <span style={{ color: d.failed > 0 ? "var(--error-fg)" : "inherit" }}>{d.failed}</span></td>
                <td>{new Date(d.updated_at).toLocaleString("ko-KR")}</td>
                <td className="cell-actions">
                  {/* pause/resume 모두 ConfirmActionForm — 5자 이상 사유 강제로 forensic 가치 회복
                      (P0 §5.1.10b / 감사 §2.14). 기존 'manual_pause' 하드코딩 제거.
                      viewer 는 disabled — P2 round. */}
                  {d.state === "rolling" || d.state === "queued" ? (
                    canMutate ? (
                      <ConfirmActionForm
                        action={pauseDeploymentAction}
                        hidden={{ deployment_id: d.id }}
                        confirmMessage={`배포 ${d.id.slice(0, 8)}… (${d.version}) 를 일시정지하시겠어요?`}
                        reasonRequired
                        buttonLabel="일시정지"
                        buttonClassName="btn small secondary"
                      />
                    ) : (
                      <DisabledActionButton buttonLabel="일시정지" buttonClassName="btn small secondary" />
                    )
                  ) : d.state === "paused" ? (
                    canMutate ? (
                      <ConfirmActionForm
                        action={resumeDeploymentAction}
                        hidden={{ deployment_id: d.id }}
                        confirmMessage={`배포 ${d.id.slice(0, 8)}… (${d.version}) 를 재개하시겠어요?`}
                        reasonRequired
                        buttonLabel="재개"
                        buttonClassName="btn small"
                      />
                    ) : (
                      <DisabledActionButton buttonLabel="재개" buttonClassName="btn small" />
                    )
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
          <nav aria-label="배포 페이지네이션" style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 14 }}>
            {dHasPrev ? (
              <Link href={`?vpage=${vPage}&dpage=${dPage - 1}`} rel="prev">← 이전</Link>
            ) : (
              <span className="muted">← 이전</span>
            )}
            {dHasNext ? (
              <Link href={`?vpage=${vPage}&dpage=${dPage + 1}`} rel="next">다음 →</Link>
            ) : (
              <span className="muted">다음 →</span>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
