import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import { readSession } from "@/lib/authCookie";
import { readIdentityFromJwt } from "@/lib/identity";
import { listOperators, type OperatorRow } from "@/lib/adminApi";
import { disableOperatorAction } from "@/lib/actions/operators";
import { ConfirmActionForm } from "@/app/components/ConfirmActionForm";
import { DisabledActionButton } from "@/app/components/DisabledActionButton";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

export default async function OperatorsPage() {
  const jwt = readSession()!;
  const identity = readIdentityFromJwt(jwt);
  const canMutate = identity?.role !== "viewer";
  const res = await listOperators({ jwt });

  function isSelf(op: OperatorRow): boolean {
    if (!identity) return false;
    if (identity.id && op.id === identity.id) return true;
    if (identity.email && op.email && op.email.toLowerCase() === identity.email.toLowerCase()) {
      return true;
    }
    return false;
  }

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          운영자
        </Typography>
        <Typography variant="body2" color="text.secondary">
          쓰택 / SecOps / SRE / Superadmin 계정. TOTP 등록 여부, 마지막 로그인, 비활성화 상태. 비활성화는 이중 확인 + 사유 필수 (audit 동반).
        </Typography>
      </Box>

      {!res.ok ? (
        <Alert severity="error" role="alert">{messageForCode(res.code, res.message)}</Alert>
      ) : (
        <Card>
          <CardHeader
            title="운영자 목록"
            subheader={res.data.operators.length === 0 ? "등록된 운영자 없음" : `${res.data.operators.length}명`}
          />
          <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
            {res.data.operators.length === 0 ? (
              <Box sx={{ p: 3 }}>
                <Alert severity="info" variant="outlined">등록된 운영자 없음</Alert>
              </Box>
            ) : (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>email</TableCell>
                      <TableCell>role</TableCell>
                      <TableCell>TOTP</TableCell>
                      <TableCell>last_login</TableCell>
                      <TableCell>created</TableCell>
                      <TableCell>status</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {res.data.operators.map((op: OperatorRow) => (
                      <TableRow key={op.id}>
                        <TableCell>{op.email}</TableCell>
                        <TableCell>
                          <Chip label={op.role} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          {op.totp_enrolled
                            ? <Chip label="설정됨" size="small" color="success" />
                            : <Chip label="미설정" size="small" color="warning" />}
                        </TableCell>
                        <TableCell>{op.last_login_at ? new Date(op.last_login_at).toLocaleString("ko-KR") : "—"}</TableCell>
                        <TableCell>{new Date(op.created_at).toLocaleDateString("ko-KR")}</TableCell>
                        <TableCell>
                          {op.disabled_at
                            ? <Chip label="비활성화" size="small" color="error" />
                            : <Chip label="활성" size="small" color="success" />}
                        </TableCell>
                        <TableCell>
                          {!op.disabled_at && (
                            isSelf(op) ? (
                              <Button
                                type="button"
                                className="btn small danger"
                                disabled
                                color="error"
                                variant="contained"
                                size="small"
                                title="본인 계정은 비활성화할 수 없습니다"
                                aria-label="본인 계정은 비활성화할 수 없습니다"
                                data-testid="self-disable-blocked"
                              >
                                비활성화 (본인)
                              </Button>
                            ) : canMutate ? (
                              <ConfirmActionForm
                                action={disableOperatorAction}
                                hidden={{ operator_id: op.id }}
                                confirmMessage={`운영자 ${op.email} 를 비활성화하시겠어요?\n\n이 운영자는 즉시 로그아웃되며 다시 로그인할 수 없습니다.`}
                                reasonRequired
                                buttonLabel="비활성화"
                                buttonClassName="btn small danger"
                              />
                            ) : (
                              <DisabledActionButton buttonLabel="비활성화" buttonClassName="btn small danger" />
                            )
                          )}
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
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
        새 운영자 추가 / 역할 변경은 SRE 자체 CLI(`scripts/operator/...`) 로만 가능하도록 서버단 정책.
      </Typography>
    </Box>
  );
}
