import Link from "next/link";
import { redirect } from "next/navigation";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { readSession, clearSession } from "@/lib/authCookie";
import { getUserDetail } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";
import { ForceLogoutButton } from "@/app/components/ForceLogoutButton";

export const dynamic = "force-dynamic";

function fmt(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ko-KR");
}

export default async function UserDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const jwt = readSession();
  if (!jwt) redirect("/login");

  const result = await getUserDetail({ jwt: jwt!, userId: params.id });

  if (!result.ok) {
    if (
      result.code === "ERR_OPERATOR_AUTH_EXPIRED" ||
      result.code === "ERR_OPERATOR_AUTH_INVALID"
    ) {
      clearSession();
      redirect(
        `/login?reason=${result.code === "ERR_OPERATOR_AUTH_EXPIRED" ? "expired" : "invalid"}`,
      );
    }
    return (
      <Box>
        <Box sx={{ mb: 2 }}>
          <Link href="/dashboard/users">← 사용자 검색</Link>
        </Box>
        <Alert severity="error" role="alert">{messageForCode(result.code)}</Alert>
        <Box sx={{ mt: 2 }}>
          <Button component={Link} href="/dashboard/users" variant="outlined">
            사용자 목록으로
          </Button>
        </Box>
      </Box>
    );
  }

  const { user, active_session_count } = result.data;
  const avatarInitial = user.email?.slice(0, 1).toUpperCase() ?? "?";
  const statusColorMap: Record<string, "success" | "warning" | "error" | "default"> = {
    active: "success",
    paused: "warning",
    pending_deletion: "error",
  };
  const statusKey = user.account_status ?? "";
  const statusColor = statusColorMap[statusKey] ?? "default";

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Link href="/dashboard/users">← 사용자 검색</Link>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: "primary.main", width: 56, height: 56, fontWeight: 700 }}>
              {avatarInitial}
            </Avatar>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 700, wordBreak: "break-all" }}>
                {user.email}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
                <Chip
                  label={user.account_status ?? "—"}
                  size="small"
                  color={statusColor === "default" ? undefined : statusColor}
                  variant={statusColor === "default" ? "outlined" : "filled"}
                />
                {user.totp_enabled ? <Chip label="TOTP" size="small" color="success" variant="outlined" /> : null}
              </Stack>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid item xs={12} md={7}>
          <Card>
            <CardHeader title="계정 정보" />
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              <List dense>
                <ListItem>
                  <ListItemText
                    primary="ID"
                    secondary={<Box component="code" sx={{ fontSize: "0.8125rem" }}>{user.id}</Box>}
                  />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText primary="상태" secondary={user.account_status ?? "—"} />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText primary="TOTP 활성" secondary={user.totp_enabled ? "✓ 활성" : "—"} />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText primary="paused_at" secondary={fmt(user.paused_at)} />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText primary="pending_deletion_at" secondary={fmt(user.pending_deletion_at)} />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText primary="가입일" secondary={fmt(user.created_at)} />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText primary="최근 로그인" secondary={fmt(user.last_login_at)} />
                </ListItem>
                <Divider component="li" />
                <ListItem>
                  <ListItemText primary="활성 세션" secondary={active_session_count} />
                </ListItem>
              </List>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={5}>
          <Card>
            <CardHeader title="운영 액션" subheader="강제 로그아웃 — 모든 세션 revoke" />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {active_session_count > 0
                  ? `현재 ${active_session_count}개 active session — 강제 로그아웃 시 모두 revoke 됩니다.`
                  : "활성 세션이 없습니다."}
              </Typography>
              <ForceLogoutButton userId={user.id} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
