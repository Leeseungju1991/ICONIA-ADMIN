import Link from "next/link";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
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
import Typography from "@mui/material/Typography";
import OpenInNewOutlined from "@mui/icons-material/OpenInNewOutlined";
import SyncOutlined from "@mui/icons-material/SyncOutlined";
import CategoryOutlined from "@mui/icons-material/CategoryOutlined";
import { readSession } from "@/lib/authCookie";
import { listProducts, type ProductRow } from "@/lib/adminApi";
import { syncProductsAction, syncCategoriesAction } from "@/lib/actions/commerce";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: { cursor?: string };
}) {
  const jwt = readSession()!;
  const res = await listProducts({
    jwt,
    cursor: searchParams.cursor,
    limit: 50,
  });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          상품 (WordPress 동기화)
        </Typography>
        <Typography variant="body2" color="text.secondary">
          WooCommerce 로부터 동기화된 상품 캐시. 결제는 WP에서 처리되며 본 화면은 카탈로그 조회 용도.
        </Typography>
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Box component="form" action={syncProductsAction}>
          <Button type="submit" variant="contained" startIcon={<SyncOutlined />}>
            상품 동기화
          </Button>
        </Box>
        <Box component="form" action={syncCategoriesAction}>
          <Button type="submit" variant="outlined" startIcon={<CategoryOutlined />}>
            카테고리 동기화
          </Button>
        </Box>
      </Stack>

      {!res.ok ? (
        <Alert severity="error" role="alert">{messageForCode(res.code, res.message)}</Alert>
      ) : (
        <Card>
          <CardHeader
            title="상품 목록"
            subheader={res.data.items.length === 0 ? "동기화된 상품 없음" : `${res.data.items.length}개 표시`}
          />
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            {res.data.items.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" variant="outlined">
                  동기화된 상품 없음. 상단 &ldquo;상품 동기화&rdquo; 버튼.
                </Alert>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell />
                        <TableCell>SKU / slug</TableCell>
                        <TableCell>이름</TableCell>
                        <TableCell>가격</TableCell>
                        <TableCell>재고</TableCell>
                        <TableCell>doll</TableCell>
                        <TableCell>status</TableCell>
                        <TableCell>synced_at</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {res.data.items.map((p: ProductRow) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            {p.primary_image ? (
                              <Avatar
                                variant="rounded"
                                src={p.primary_image}
                                alt={p.name}
                                sx={{ width: 40, height: 40 }}
                              />
                            ) : (
                              <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: "grey.200" }}>
                                {p.name.slice(0, 1)}
                              </Avatar>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box component="code" sx={{ fontSize: "0.75rem", display: "block" }}>{p.sku ?? "—"}</Box>
                            <Typography variant="caption" color="text.secondary">{p.slug}</Typography>
                          </TableCell>
                          <TableCell>
                            <Box>{p.name}</Box>
                            {p.permalink ? (
                              <Link href={p.permalink} target="_blank" rel="noreferrer" style={{ fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4, color: "var(--mui-palette-primary-main, #1A73E8)" }}>
                                WP 열기 <OpenInNewOutlined sx={{ fontSize: 12 }} />
                              </Link>
                            ) : null}
                          </TableCell>
                          <TableCell>{p.price} {p.currency}</TableCell>
                          <TableCell>
                            {p.stock_quantity != null ? p.stock_quantity : (
                              <Typography component="span" variant="caption" color="text.secondary">{p.stock_status}</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.doll_related ? <Chip label="doll" size="small" color="success" /> : null}
                          </TableCell>
                          <TableCell>
                            {p.status === "active"
                              ? <Chip label={p.status} size="small" color="success" />
                              : <Chip label={p.status} size="small" variant="outlined" />}
                          </TableCell>
                          <TableCell>{new Date(p.synced_at).toLocaleString("ko-KR")}</TableCell>
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
