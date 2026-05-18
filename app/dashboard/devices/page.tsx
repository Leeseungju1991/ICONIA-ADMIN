import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import MenuItem from "@mui/material/MenuItem";
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
import { listDevices, type DeviceRow } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

type ChipColor = "default" | "success" | "warning" | "error";

function StatusBadge({ status, online }: { status: string; online: boolean }) {
  if (status === "lost") return <Chip label="분실신고" size="small" color="error" />;
  if (status === "unpaired") return <Chip label="미페어링" size="small" variant="outlined" />;
  if (status === "archived") return <Chip label="아카이브" size="small" variant="outlined" />;
  return online
    ? <Chip label="온라인" size="small" color="success" />
    : <Chip label="오프라인" size="small" color="warning" />;
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
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          디바이스
        </Typography>
        <Typography variant="body2" color="text.secondary">
          인형/디바이스 링크 목록. 검색, 상태 필터, 강제 언페어링, 분실 신고.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box component="form">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-end" }}>
              <TextField
                name="q"
                label="검색"
                placeholder="serial / device_id / user email"
                defaultValue={searchParams.q ?? ""}
                size="small"
                fullWidth
              />
              <TextField
                select
                name="status"
                label="상태"
                defaultValue={searchParams.status ?? ""}
                size="small"
                sx={{ minWidth: 180 }}
              >
                <MenuItem value="">전체</MenuItem>
                <MenuItem value="active">active</MenuItem>
                <MenuItem value="unpaired">unpaired</MenuItem>
                <MenuItem value="lost">lost</MenuItem>
                <MenuItem value="archived">archived</MenuItem>
              </TextField>
              <Button type="submit" variant="contained">검색</Button>
            </Stack>
          </Box>
        </CardContent>
      </Card>

      {!res.ok ? (
        <Alert severity="error" role="alert">{messageForCode(res.code, res.message)}</Alert>
      ) : (
        <Card>
          <CardHeader
            title="디바이스 목록"
            subheader={res.data.items.length === 0 ? "결과 없음" : `${res.data.items.length}개 표시`}
          />
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            {res.data.items.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" variant="outlined">결과 없음</Alert>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>device_id</TableCell>
                      <TableCell>serial</TableCell>
                      <TableCell>FW</TableCell>
                      <TableCell>HW</TableCell>
                      <TableCell>battery</TableCell>
                      <TableCell>last_seen</TableCell>
                      <TableCell>status</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {res.data.items.map((d: DeviceRow) => (
                      <TableRow key={d.device_id}>
                        <TableCell>
                          <Box component="code" sx={{ fontSize: "0.75rem" }}>{d.device_id.slice(0, 12)}…</Box>
                        </TableCell>
                        <TableCell>{d.serial ?? "—"}</TableCell>
                        <TableCell>{d.firmware_version ?? "—"}</TableCell>
                        <TableCell>{d.hardware_revision ?? "—"}</TableCell>
                        <TableCell>{d.last_battery_percent != null ? `${d.last_battery_percent}%` : "—"}</TableCell>
                        <TableCell>{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString("ko-KR") : "—"}</TableCell>
                        <TableCell>
                          <StatusBadge status={d.status} online={d.online} />
                        </TableCell>
                        <TableCell>
                          <Button
                            component={Link}
                            href={`/dashboard/devices/${encodeURIComponent(d.device_id)}`}
                            variant="outlined"
                            size="small"
                          >
                            상세
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
