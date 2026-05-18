import Link from "next/link";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import FormControlLabel from "@mui/material/FormControlLabel";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { readSession } from "@/lib/authCookie";
import { listWebhookEvents, type WebhookEventRow } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

export default async function WebhooksPage({
  searchParams,
}: {
  searchParams: { cursor?: string; only_failures?: string };
}) {
  const jwt = readSession()!;
  const onlyFailures = searchParams.only_failures === "1";
  const res = await listWebhookEvents({
    jwt,
    cursor: searchParams.cursor,
    onlyFailures,
    limit: 50,
  });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          WooCommerce 웹훅
        </Typography>
        <Typography variant="body2" color="text.secondary">
          WP에서 수신된 webhook 이벤트 로그. delivery_id 기준 중복 차단, HMAC-SHA256 서명 검증 통과 일령에만 처리. processed=false 는 재시도 대상.
        </Typography>
      </Box>

      <Box component="form" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <FormControlLabel
            control={
              <Checkbox
                name="only_failures"
                value="1"
                defaultChecked={onlyFailures}
                size="small"
              />
            }
            label="실패만"
          />
          <Button type="submit" variant="contained" size="small">적용</Button>
        </Stack>
      </Box>

      {!res.ok ? (
        <Alert severity="error" role="alert">{messageForCode(res.code, res.message)}</Alert>
      ) : (
        <Card>
          <CardHeader
            title="웹훅 이벤트"
            subheader={res.data.items.length === 0 ? "이벤트 없음" : `${res.data.items.length}건 표시`}
          />
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            {res.data.items.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" variant="outlined">이벤트 없음</Alert>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>delivery_id</TableCell>
                        <TableCell>topic</TableCell>
                        <TableCell>resource / event</TableCell>
                        <TableCell>processed</TableCell>
                        <TableCell>failure</TableCell>
                        <TableCell>received</TableCell>
                        <TableCell>processed_at</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {res.data.items.map((e: WebhookEventRow) => (
                        <TableRow key={e.id}>
                          <TableCell>
                            <Box component="code" sx={{ fontSize: "0.6875rem" }}>
                              {e.delivery_id.slice(0, 12)}…
                            </Box>
                          </TableCell>
                          <TableCell>{e.topic}</TableCell>
                          <TableCell>{e.resource}.{e.event}</TableCell>
                          <TableCell>
                            {e.processed
                              ? <Chip label="OK" size="small" color="success" />
                              : <Chip label="FAIL" size="small" color="error" />}
                          </TableCell>
                          <TableCell sx={{ maxWidth: 280, color: "error.main", fontSize: "0.75rem" }}>
                            {e.failure_reason ?? ""}
                          </TableCell>
                          <TableCell>{new Date(e.created_at).toLocaleString("ko-KR")}</TableCell>
                          <TableCell>{e.processed_at ? new Date(e.processed_at).toLocaleString("ko-KR") : "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {res.data.next_cursor ? (
                  <Box sx={{ p: 2 }}>
                    <Link href={`?cursor=${encodeURIComponent(res.data.next_cursor)}${onlyFailures ? "&only_failures=1" : ""}`}>
                      다음 몇 건 →
                    </Link>
                  </Box>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
