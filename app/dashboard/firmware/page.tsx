import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { readSession } from "@/lib/authCookie";
import { listFirmware, type DeploymentRow, type FirmwareVersionRow } from "@/lib/adminApi";
import { pauseDeploymentAction, resumeDeploymentAction } from "@/lib/actions/firmware";
import { ConfirmActionForm } from "@/app/components/ConfirmActionForm";
import { DisabledActionButton } from "@/app/components/DisabledActionButton";
import { messageForCode } from "@/lib/errorMessages";
import { readIdentityFromJwt } from "@/lib/identity";

export const dynamic = "force-dynamic";

// 페이지 단위 50건 — Server 의 GET /api/v1/admin/firmware 는 cursor 미지원
// (FirmwareList = { versions, deployments } 전체 응답). 클라이언트 사이드 페이지네이션 fallback (P1 §5.2 #33).
const PAGE_SIZE = 50;

type DeploymentColor = "default" | "success" | "warning" | "error";

function DeploymentBadge({ state }: { state: string }) {
  let color: DeploymentColor = "default";
  if (state === "completed" || state === "rolling") color = "success";
  else if (state === "paused") color = "warning";
  else if (state === "aborted") color = "error";
  return <Chip label={state} size="small" color={color} variant={color === "default" ? "outlined" : "filled"} />;
}

function PaginationNav({
  hasPrev,
  hasNext,
  prevHref,
  nextHref,
  ariaLabel,
}: {
  hasPrev: boolean;
  hasNext: boolean;
  prevHref: string;
  nextHref: string;
  ariaLabel: string;
}) {
  return (
    <Box component="nav" aria-label={ariaLabel} sx={{ display: "flex", gap: 2, p: 2 }}>
      {hasPrev ? <Link href={prevHref} rel="prev">← 이전</Link> : <Typography variant="body2" color="text.secondary">← 이전</Typography>}
      {hasNext ? <Link href={nextHref} rel="next">다음 →</Link> : <Typography variant="body2" color="text.secondary">다음 →</Typography>}
    </Box>
  );
}

export default async function FirmwarePage({
  searchParams,
}: {
  searchParams: { vpage?: string; dpage?: string };
}) {
  const jwt = readSession()!;
  const identity = readIdentityFromJwt(jwt);
  const canMutate = identity?.role !== "viewer";
  const res = await listFirmware({ jwt });

  if (!res.ok) {
    return (
      <Box>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
          펌웨어 배포
        </Typography>
        <Alert severity="error" role="alert">{messageForCode(res.code, res.message)}</Alert>
      </Box>
    );
  }

  const { versions, deployments } = res.data;

  const vTotalPages = Math.max(1, Math.ceil(versions.length / PAGE_SIZE));
  const vRequested = Math.max(1, Number.parseInt(searchParams?.vpage ?? "1", 10) || 1);
  const vPage = Math.min(vRequested, vTotalPages);
  const vSliceStart = (vPage - 1) * PAGE_SIZE;
  const versionsPage = versions.slice(vSliceStart, vSliceStart + PAGE_SIZE);

  const dTotalPages = Math.max(1, Math.ceil(deployments.length / PAGE_SIZE));
  const dRequested = Math.max(1, Number.parseInt(searchParams?.dpage ?? "1", 10) || 1);
  const dPage = Math.min(dRequested, dTotalPages);
  const dSliceStart = (dPage - 1) * PAGE_SIZE;
  const deploymentsPage = deployments.slice(dSliceStart, dSliceStart + PAGE_SIZE);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          펌웨어 배포
        </Typography>
        <Typography variant="body2" color="text.secondary">
          서버 매니페스트 기준 펌웨어 버전 + 배포 이력. 일시정지 / 재개는 운영자 권한 필요.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardHeader
          title={`버전 (${versions.length}건)`}
          subheader={versions.length === 0 ? "등록된 펌웨어 없음" : `페이지 ${vPage} / ${vTotalPages} · 보기 ${vSliceStart + 1}–${vSliceStart + versionsPage.length}`}
        />
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {versions.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="info" variant="outlined">등록된 펌웨어 없음</Alert>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>version</TableCell>
                      <TableCell>channel</TableCell>
                      <TableCell>released</TableCell>
                      <TableCell>size</TableCell>
                      <TableCell>sha256</TableCell>
                      <TableCell>notes</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {versionsPage.map((v: FirmwareVersionRow) => (
                      <TableRow key={`${v.channel}-${v.version}`}>
                        <TableCell>
                          <Box component="code">{v.version}</Box>
                        </TableCell>
                        <TableCell>
                          <Chip label={v.channel} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>{new Date(v.released_at).toLocaleString("ko-KR")}</TableCell>
                        <TableCell>{v.size_bytes != null ? `${(v.size_bytes / 1024).toFixed(0)} KB` : "—"}</TableCell>
                        <TableCell>
                          <Box component="code" sx={{ fontSize: "0.6875rem" }}>{v.sha256 ? `${v.sha256.slice(0, 12)}…` : "—"}</Box>
                        </TableCell>
                        <TableCell>{v.notes ?? ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <PaginationNav
                hasPrev={vPage > 1}
                hasNext={vPage < vTotalPages}
                prevHref={`?vpage=${vPage - 1}&dpage=${dPage}`}
                nextHref={`?vpage=${vPage + 1}&dpage=${dPage}`}
                ariaLabel="버전 페이지네이션"
              />
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader
          title={`배포 (${deployments.length}건)`}
          subheader={deployments.length === 0 ? "진행 중인 배포 없음" : `페이지 ${dPage} / ${dTotalPages} · 보기 ${dSliceStart + 1}–${dSliceStart + deploymentsPage.length}`}
        />
        <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
          {deployments.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <Alert severity="info" variant="outlined">진행 중인 배포 없음</Alert>
            </Box>
          ) : (
            <>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>id</TableCell>
                      <TableCell>version</TableCell>
                      <TableCell>cohort</TableCell>
                      <TableCell>state</TableCell>
                      <TableCell>%</TableCell>
                      <TableCell>ok / fail</TableCell>
                      <TableCell>updated</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deploymentsPage.map((d: DeploymentRow) => (
                      <TableRow key={d.id}>
                        <TableCell>
                          <Box component="code" sx={{ fontSize: "0.75rem" }}>{d.id.slice(0, 8)}…</Box>
                        </TableCell>
                        <TableCell>
                          <Box component="code">{d.version}</Box>
                        </TableCell>
                        <TableCell>
                          <Box component="code" sx={{ fontSize: "0.75rem" }}>
                            {d.cohort_id ? d.cohort_id.slice(0, 8) + "…" : "all"}
                          </Box>
                        </TableCell>
                        <TableCell><DeploymentBadge state={d.state} /></TableCell>
                        <TableCell>{d.rollout_percent}%</TableCell>
                        <TableCell>
                          {d.succeeded} /{" "}
                          <Box component="span" sx={{ color: d.failed > 0 ? "error.main" : "inherit" }}>{d.failed}</Box>
                        </TableCell>
                        <TableCell>{new Date(d.updated_at).toLocaleString("ko-KR")}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
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
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <PaginationNav
                hasPrev={dPage > 1}
                hasNext={dPage < dTotalPages}
                prevHref={`?vpage=${vPage}&dpage=${dPage - 1}`}
                nextHref={`?vpage=${vPage}&dpage=${dPage + 1}`}
                ariaLabel="배포 페이지네이션"
              />
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
