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
import SyncOutlined from "@mui/icons-material/SyncOutlined";
import { readSession } from "@/lib/authCookie";
import { listOrders, type AdminOrderRow } from "@/lib/adminApi";
import { syncOrdersAction } from "@/lib/actions/commerce";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

// IMPORTANT — 본 화면은 결제수단(payment_method) / 거래아이디(transaction_id) 등 민감 컬럼을 일체 노출하지 않는다.

type ChipColor = "default" | "success" | "warning" | "error";

function statusColor(status: string): ChipColor {
  switch (status) {
    case "completed":
    case "processing":
      return "success";
    case "on_hold":
      return "warning";
    case "pending":
      return "default";
    case "cancelled":
    case "refunded":
    case "failed":
      return "error";
    default:
      return "default";
  }
}

const STATUS_OPTIONS = ["pending", "processing", "on_hold", "completed", "cancelled", "refunded", "failed"];

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { cursor?: string; status?: string };
}) {
  const jwt = readSession()!;
  const res = await listOrders({
    jwt,
    cursor: searchParams.cursor,
    status: searchParams.status,
    limit: 50,
  });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          주문 (처리 상태 우선)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          결제수단 / 거래 상세는 본 화면에서 노출하지 않습니다 (PCI 책임 분리). 환불/결제 조정은 WordPress / WooCommerce admin 에서 처리.
        </Typography>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 3 }} alignItems={{ sm: "center" }}>
        <Box component="form" sx={{ display: "flex", gap: 1.5, flex: 1 }}>
          <TextField
            select
            name="status"
            label="status"
            defaultValue={searchParams.status ?? ""}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">전체 상태</MenuItem>
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
          <Button type="submit" variant="contained" size="medium">필터</Button>
        </Box>
        <Box component="form" action={syncOrdersAction}>
          <Button type="submit" variant="outlined" size="medium" startIcon={<SyncOutlined />}>
            WP에서 주문 동기화
          </Button>
        </Box>
      </Stack>

      {!res.ok ? (
        <Alert severity="error" role="alert">{messageForCode(res.code, res.message)}</Alert>
      ) : (
        <Card>
          <CardHeader
            title="주문 목록"
            subheader={res.data.items.length === 0 ? "주문 없음" : `${res.data.items.length}건 표시`}
          />
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            {res.data.items.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" variant="outlined">주문 없음</Alert>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>order</TableCell>
                        <TableCell>woo_id</TableCell>
                        <TableCell>customer</TableCell>
                        <TableCell>items</TableCell>
                        <TableCell>total</TableCell>
                        <TableCell>status</TableCell>
                        <TableCell>paid_at</TableCell>
                        <TableCell>completed_at</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {res.data.items.map((o: AdminOrderRow) => (
                        <TableRow key={o.id}>
                          <TableCell>
                            <Box component="code" sx={{ fontSize: "0.75rem" }}>{o.id.slice(0, 8)}…</Box>
                          </TableCell>
                          <TableCell>{o.woo_id ?? "—"}</TableCell>
                          <TableCell>
                            {o.customer_email ?? (
                              <Typography component="span" variant="body2" color="text.secondary">guest</Typography>
                            )}
                          </TableCell>
                          <TableCell>{o.item_count}</TableCell>
                          <TableCell>{o.total_amount} {o.currency}</TableCell>
                          <TableCell>
                            <Chip label={o.status} size="small" color={statusColor(o.status)} variant={statusColor(o.status) === "default" ? "outlined" : "filled"} />
                          </TableCell>
                          <TableCell>{o.paid_at ? new Date(o.paid_at).toLocaleString("ko-KR") : "—"}</TableCell>
                          <TableCell>{o.completed_at ? new Date(o.completed_at).toLocaleString("ko-KR") : "—"}</TableCell>
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
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
