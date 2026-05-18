import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { readSession } from "@/lib/authCookie";
import { getDeviceDetail } from "@/lib/adminApi";
import { forceUnpairAction, markLostAction } from "@/lib/actions/devices";
import { ConfirmActionForm } from "@/app/components/ConfirmActionForm";
import { DisabledActionButton } from "@/app/components/DisabledActionButton";
import { messageForCode } from "@/lib/errorMessages";
import { readIdentityFromJwt } from "@/lib/identity";

export const dynamic = "force-dynamic";

export default async function DeviceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const jwt = readSession()!;
  const identity = readIdentityFromJwt(jwt);
  // viewer 는 force-unpair / mark-lost 차단 — UX 가시화 (서버도 403 차단).
  const canMutate = identity?.role !== "viewer";
  const res = await getDeviceDetail({ jwt, deviceId: params.id });

  if (!res.ok) {
    return (
      <Box>
        <Box sx={{ mb: 2 }}>
          <Link href="/dashboard/devices">← 목록</Link>
        </Box>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700, mb: 2 }}>
          디바이스 상세
        </Typography>
        <Alert severity="error" role="alert">
          {messageForCode(res.code, res.message)}
        </Alert>
      </Box>
    );
  }

  const d = res.data.device;

  return (
    <Box>
      <Box sx={{ mb: 1.5 }}>
        <Link href="/dashboard/devices">← 목록</Link>
      </Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          {d.serial ?? d.device_id}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          device_id: <Box component="code" sx={{ fontSize: "0.8125rem" }}>{d.device_id}</Box>
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="기본 정보" />
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              <TableContainer>
                <Table size="small">
                  <TableBody>
                    <Row label="user_id" value={<Box component="code" sx={{ fontSize: "0.75rem" }}>{d.user_id ?? "—"}</Box>} />
                    <Row label="firmware" value={d.firmware_version ?? "—"} />
                    <Row label="hardware" value={d.hardware_revision ?? "—"} />
                    <Row label="battery" value={d.last_battery_percent != null ? `${d.last_battery_percent}%` : "—"} />
                    <Row label="last_seen" value={d.last_seen_at ? new Date(d.last_seen_at).toLocaleString("ko-KR") : "—"} />
                    <Row label="paired" value={d.paired_at ? new Date(d.paired_at).toLocaleString("ko-KR") : "—"} />
                    <Row label="status" value={`${d.status}${d.online ? " / online" : " / offline"}`} />
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="OTA 이력" />
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              {res.data.ota_history && res.data.ota_history.length > 0 ? (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>version</TableCell>
                        <TableCell>result</TableCell>
                        <TableCell>at</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {res.data.ota_history.map((h, i) => (
                        <TableRow key={`${h.version}-${i}`}>
                          <TableCell>{h.version}</TableCell>
                          <TableCell>{h.result}</TableCell>
                          <TableCell>{new Date(h.at).toLocaleString("ko-KR")}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <Box sx={{ p: 3 }}>
                  <Alert severity="info" variant="outlined">OTA 시도 기록 없음</Alert>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="h5" component="h2" sx={{ fontWeight: 600, mt: 2, mb: 2 }}>
            운영 액션
          </Typography>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="강제 언페어링" subheader="이중 확인 + 사유 입력 필요" />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                사용자 키 + 디바이스 세션을 모두 무효화합니다.
              </Typography>
              {canMutate ? (
                <ConfirmActionForm
                  action={forceUnpairAction}
                  hidden={{ device_id: d.device_id }}
                  confirmMessage={`디바이스 ${d.serial ?? d.device_id} 의 페어링을 강제로 해제하시겠어요?\n\n사용자 키 + 디바이스 세션이 모두 무효화됩니다.`}
                  reasonRequired
                  buttonLabel="강제 언페어링"
                  buttonClassName="btn full danger"
                />
              ) : (
                <DisabledActionButton buttonLabel="강제 언페어링" buttonClassName="btn full danger" />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardHeader title="분실 표시" subheader="CS 접수 후 lost 상태로 이전" />
            <CardContent>
              {canMutate ? (
                <Box component="form" action={markLostAction}>
                  <Stack spacing={2}>
                    <Typography variant="body2" color="text.secondary">
                      사용자 CS 접수 후 디바이스를 lost 상태로 이전.
                    </Typography>
                    <input type="hidden" name="device_id" value={d.device_id} />
                    <TextField
                      type="text"
                      name="note"
                      label="note (선택)"
                      placeholder="CS 티켓 번호 등"
                      size="small"
                      fullWidth
                    />
                    <Button type="submit" variant="outlined" fullWidth className="btn full secondary">
                      분실 표시
                    </Button>
                  </Stack>
                </Box>
              ) : (
                <>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    사용자 CS 접수 후 디바이스를 lost 상태로 이전.
                  </Typography>
                  <DisabledActionButton buttonLabel="분실 표시" buttonClassName="btn full secondary" />
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <TableRow>
      <TableCell sx={{ color: "text.secondary", width: 160, fontWeight: 500 }}>{label}</TableCell>
      <TableCell>{value}</TableCell>
    </TableRow>
  );
}
