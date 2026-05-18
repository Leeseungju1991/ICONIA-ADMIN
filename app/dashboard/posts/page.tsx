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
import { listPosts, type PostRow } from "@/lib/adminApi";
import { hidePostAction, unhidePostAction } from "@/lib/actions/posts";
import { ConfirmActionForm } from "@/app/components/ConfirmActionForm";
import { DisabledActionButton } from "@/app/components/DisabledActionButton";
import { messageForCode } from "@/lib/errorMessages";
import { readIdentityFromJwt } from "@/lib/identity";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  if (status === "hidden") return <Chip label="숨김" size="small" color="warning" />;
  if (status === "taken_down") return <Chip label="내림" size="small" color="error" />;
  return <Chip label="공개" size="small" color="success" />;
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: { filter?: "all" | "reported" | "hidden" };
}) {
  const jwt = readSession()!;
  const identity = readIdentityFromJwt(jwt);
  const canMutate = identity?.role !== "viewer";
  const filter = searchParams.filter ?? "reported";
  const res = await listPosts({ jwt, filter, limit: 50 });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          게시물 모더레이션
        </Typography>
        <Typography variant="body2" color="text.secondary">
          신고 누적, 숨김, 내림 처리. 일반 공개 게시물은 &ldquo;전체&rdquo; 필터에서 조회. 액션은 사전 확인 + 사유 필수.
        </Typography>
      </Box>

      <Box component="form" sx={{ mb: 3 }}>
        <Stack direction="row" spacing={2} alignItems="center">
          <TextField
            select
            name="filter"
            label="filter"
            defaultValue={filter}
            size="small"
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="reported">신고됨</MenuItem>
            <MenuItem value="hidden">숨김</MenuItem>
            <MenuItem value="all">전체</MenuItem>
          </TextField>
          <Button type="submit" variant="contained" size="medium">적용</Button>
        </Stack>
      </Box>

      {!res.ok ? (
        <Alert severity="error" role="alert">{messageForCode(res.code, res.message)}</Alert>
      ) : (
        <Card>
          <CardHeader
            title="게시물"
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
                      <TableCell>post_id</TableCell>
                      <TableCell>author</TableCell>
                      <TableCell>excerpt</TableCell>
                      <TableCell>신고</TableCell>
                      <TableCell>반응</TableCell>
                      <TableCell>댓글</TableCell>
                      <TableCell>status</TableCell>
                      <TableCell>created</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {res.data.items.map((p: PostRow) => (
                      <TableRow key={p.post_id}>
                        <TableCell>
                          <Box component="code" sx={{ fontSize: "0.75rem" }}>{p.post_id.slice(0, 8)}…</Box>
                        </TableCell>
                        <TableCell>{p.author_handle ?? p.author_user_id.slice(0, 8)}</TableCell>
                        <TableCell
                          sx={{
                            maxWidth: 320,
                            overflow: "hidden",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                          }}
                        >
                          {p.body_excerpt}
                        </TableCell>
                        <TableCell sx={{ color: p.reported_count > 0 ? "error.main" : "inherit", fontWeight: p.reported_count > 0 ? 600 : 400 }}>
                          {p.reported_count}
                        </TableCell>
                        <TableCell>{p.reaction_count}</TableCell>
                        <TableCell>{p.comment_count}</TableCell>
                        <TableCell><StatusBadge status={p.status} /></TableCell>
                        <TableCell>{new Date(p.created_at).toLocaleString("ko-KR")}</TableCell>
                        <TableCell>
                          {p.status === "visible" ? (
                            canMutate ? (
                              <ConfirmActionForm
                                action={hidePostAction}
                                hidden={{ post_id: p.post_id }}
                                confirmMessage={`이 게시물을 숨기시겠어요?\n\npost_id=${p.post_id.slice(0, 8)}…`}
                                reasonRequired
                                buttonLabel="숨김"
                                buttonClassName="btn small danger"
                              />
                            ) : (
                              <DisabledActionButton buttonLabel="숨김" buttonClassName="btn small danger" />
                            )
                          ) : p.status === "hidden" ? (
                            canMutate ? (
                              <ConfirmActionForm
                                action={unhidePostAction}
                                hidden={{ post_id: p.post_id }}
                                confirmMessage={`숨김을 해제하시겠어요? 게시물이 다시 공개됩니다.\n\npost_id=${p.post_id.slice(0, 8)}…`}
                                reasonRequired={false}
                                buttonLabel="숨김 해제"
                                buttonClassName="btn small secondary"
                              />
                            ) : (
                              <DisabledActionButton buttonLabel="숨김 해제" buttonClassName="btn small secondary" />
                            )
                          ) : null}
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
