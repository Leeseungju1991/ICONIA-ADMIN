import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
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
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import HashtagIcon from "@mui/icons-material/TagOutlined";
import { readSession } from "@/lib/authCookie";
import { listAuditLog, type AuditEntry } from "@/lib/auditApi";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

// Audit log 독립 조회 페이지.
// SOC2 / ISO27001 / PIPA: 운영자 행위 추적 필수.
// 권한: secops/sre/superadmin (middleware 도 차단, 서버도 차단).

function OutcomeBadge({ outcome }: { outcome: string | null }) {
  if (outcome === "success") return <Chip label="success" size="small" color="success" />;
  if (outcome === "denied") return <Chip label="denied" size="small" color="warning" />;
  if (outcome === "error") return <Chip label="error" size="small" color="error" />;
  return <Chip label={outcome ?? "—"} size="small" variant="outlined" />;
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: { action?: string; operator_id?: string; target_type?: string; since?: string; cursor?: string };
}) {
  const jwt = readSession()!;
  const res = await listAuditLog({
    jwt,
    action: searchParams.action,
    operatorId: searchParams.operator_id,
    targetType: searchParams.target_type,
    since: searchParams.since,
    cursor: searchParams.cursor,
    limit: 100,
  });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Audit 로그
        </Typography>
        <Typography variant="body2" color="text.secondary">
          운영자 권한 행사 추적. 기본 24시간 구간. SOC2/ISO27001 요구.
        </Typography>
        <Box sx={{ mt: 1 }}>
          <Link href="/dashboard/audit/export">CSV 내보내기 →</Link>
        </Box>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardHeader title="필터" subheader="action / operator / target / 시작 시각" />
        <CardContent>
          <Box component="form">
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "flex-end" }}>
              <TextField
                name="action"
                label="action"
                placeholder="예: device_unpaired"
                defaultValue={searchParams.action ?? ""}
                size="small"
                fullWidth
              />
              <TextField
                name="operator_id"
                label="operator_id (UUID)"
                defaultValue={searchParams.operator_id ?? ""}
                size="small"
                fullWidth
              />
              <TextField
                name="target_type"
                label="target_type"
                placeholder="예: device, feed_post"
                defaultValue={searchParams.target_type ?? ""}
                size="small"
                fullWidth
              />
              <TextField
                type="datetime-local"
                name="since"
                label="since"
                InputLabelProps={{ shrink: true }}
                defaultValue={searchParams.since ?? ""}
                size="small"
                fullWidth
              />
              <Button type="submit" variant="contained" sx={{ minWidth: 100 }}>
                필터
              </Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {!res.ok ? (
        <Alert severity="error" role="alert">
          {messageForCode(res.code, res.message)}
        </Alert>
      ) : (
        <Card>
          <CardHeader
            title="감사 로그 (24h)"
            subheader={res.data.items.length === 0 ? "조건에 맞는 기록 없음" : `since: ${res.data.since} · 조회 ${res.data.items.length}건`}
          />
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            {res.data.items.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" variant="outlined">
                  조건에 맞는 기록 없음
                </Alert>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>seq</TableCell>
                        <TableCell>action</TableCell>
                        <TableCell>outcome</TableCell>
                        <TableCell>operator</TableCell>
                        <TableCell>role</TableCell>
                        <TableCell>target</TableCell>
                        <TableCell>ip</TableCell>
                        <TableCell>created</TableCell>
                        <TableCell>chain</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {res.data.items.map((row: AuditEntry) => (
                        <TableRow key={row.id}>
                          <TableCell>
                            <Box component="code" sx={{ fontSize: "0.6875rem" }}>{row.sequence_no ?? "—"}</Box>
                          </TableCell>
                          <TableCell>
                            <Box component="code" sx={{ fontSize: "0.6875rem" }}>{row.action}</Box>
                          </TableCell>
                          <TableCell>
                            <OutcomeBadge outcome={row.action_outcome} />
                          </TableCell>
                          <TableCell>
                            <Box component="code" sx={{ fontSize: "0.6875rem" }}>
                              {row.operator_id ? row.operator_id.slice(0, 8) + "…" : "—"}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Chip label={row.operator_role ?? "—"} size="small" variant="outlined" />
                          </TableCell>
                          <TableCell>
                            {row.target_resource_type ? (
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Chip label={row.target_resource_type} size="small" variant="outlined" />
                                <Box component="code" sx={{ fontSize: "0.6875rem" }}>
                                  {row.target_resource_id ? row.target_resource_id.slice(0, 8) + "…" : "—"}
                                </Box>
                              </Stack>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            <Box component="code" sx={{ fontSize: "0.6875rem" }}>{row.ip}</Box>
                          </TableCell>
                          <TableCell>{new Date(row.created_at).toLocaleString("ko-KR")}</TableCell>
                          <TableCell>
                            <Tooltip title={`prev: ${row.prev_hash ?? "—"} · current: ${row.current_hash ?? "—"}`}>
                              <Box sx={{ display: "inline-flex", alignItems: "center", color: "text.secondary" }}>
                                <HashtagIcon fontSize="inherit" sx={{ mr: 0.5 }} />
                                <Box component="code" sx={{ fontSize: "0.625rem" }}>
                                  {row.current_hash ? row.current_hash.slice(0, 8) + "…" : "—"}
                                </Box>
                              </Box>
                            </Tooltip>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {res.data.next_cursor ? (
                  <Box sx={{ p: 2 }}>
                    <Link href={`?cursor=${encodeURIComponent(res.data.next_cursor)}`}>다음 몇 건 →</Link>
                  </Box>
                ) : null}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", px: 2, pb: 2 }}>
                  전체 chain 변조 검증은 서버측 services/auditChainVerifier 를 링크 이벤트로 실행.
                </Typography>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
