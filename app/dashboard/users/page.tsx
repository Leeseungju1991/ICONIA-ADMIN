import Link from "next/link";
import { redirect } from "next/navigation";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Pagination from "@mui/material/Pagination";
import PaginationItem from "@mui/material/PaginationItem";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import SearchOutlined from "@mui/icons-material/SearchOutlined";
import { readSession, clearSession } from "@/lib/authCookie";
import { searchUsers } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";

// 본 페이지는 app/dashboard/layout.tsx 의 사이드바 셸 안에서 렌더된다.
export const dynamic = "force-dynamic";

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ko-KR");
}

const PAGE_SIZE = 50;
const MAX_PAGES_FETCHED = 10; // 한 번에 최대 500건만 client 메모리에 보관

export default async function UsersSearchPage({
  searchParams,
}: {
  searchParams: { email?: string; page?: string };
}) {
  const jwt = readSession();
  if (!jwt) redirect("/login");

  const query = (searchParams?.email || "").trim();
  const requestedPage = Math.max(1, Number.parseInt(searchParams?.page ?? "1", 10) || 1);

  let result = null as Awaited<ReturnType<typeof searchUsers>> | null;
  if (query) {
    result = await searchUsers({
      jwt: jwt!,
      email: query,
      limit: PAGE_SIZE * MAX_PAGES_FETCHED,
    });
    if (
      !result.ok &&
      (result.code === "ERR_OPERATOR_AUTH_EXPIRED" ||
        result.code === "ERR_OPERATOR_AUTH_INVALID")
    ) {
      clearSession();
      redirect(
        `/login?reason=${result.code === "ERR_OPERATOR_AUTH_EXPIRED" ? "expired" : "invalid"}`,
      );
    }
  }

  const allUsers = result && result.ok ? result.data.users : [];
  const totalPages = Math.max(1, Math.ceil(allUsers.length / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const sliceStart = (page - 1) * PAGE_SIZE;
  const pageUsers = allUsers.slice(sliceStart, sliceStart + PAGE_SIZE);

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          사용자 검색
        </Typography>
        <Typography variant="body2" color="text.secondary">
          이메일(또는 일부)로 사용자를 검색해 상태·TOTP·가입일을 확인하고 상세로 이동합니다.
        </Typography>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <form action="/dashboard/users" method="get">
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems={{ sm: "flex-end" }}>
              <TextField
                id="email"
                name="email"
                type="text"
                label="이메일 또는 일부"
                placeholder="alice 또는 @example.com"
                defaultValue={query}
                autoFocus
                size="small"
                fullWidth
              />
              <Button type="submit" variant="contained" startIcon={<SearchOutlined />} sx={{ minWidth: 120 }}>
                검색
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>

      {result && !result.ok ? (
        <Alert severity="error" role="alert">
          {messageForCode(result.code)}
        </Alert>
      ) : null}

      {result && result.ok ? (
        <Card>
          <CardHeader
            title={`결과 (${allUsers.length}건${allUsers.length >= PAGE_SIZE * MAX_PAGES_FETCHED ? "+" : ""})`}
            subheader={
              allUsers.length === 0
                ? "일치하는 사용자가 없습니다."
                : `페이지 ${page} / ${totalPages} · 보기 ${sliceStart + 1}–${sliceStart + pageUsers.length}`
            }
          />
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            {allUsers.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" variant="outlined">일치하는 사용자가 없습니다.</Alert>
              </Box>
            ) : (
              <>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>이메일</TableCell>
                        <TableCell>상태</TableCell>
                        <TableCell>TOTP</TableCell>
                        <TableCell>가입일</TableCell>
                        <TableCell>액션</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pageUsers.map((u) => (
                        <TableRow key={u.id}>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>{u.account_status ?? "—"}</TableCell>
                          <TableCell>{u.totp_enabled ? "✓" : "—"}</TableCell>
                          <TableCell sx={{ color: "text.secondary", fontSize: "0.8125rem" }}>
                            {fmt(u.created_at)}
                          </TableCell>
                          <TableCell>
                            <Link href={`/dashboard/users/${u.id}`}>상세</Link>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
                {totalPages > 1 ? (
                  <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}>
                    <Pagination
                      count={totalPages}
                      page={page}
                      siblingCount={1}
                      boundaryCount={1}
                      renderItem={(item) => (
                        <PaginationItem
                          component={Link}
                          href={`?email=${encodeURIComponent(query)}&page=${item.page}`}
                          {...item}
                        />
                      )}
                    />
                  </Box>
                ) : null}
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </Box>
  );
}
