import Box from "@mui/material/Box";
import MuiAppBar from "@mui/material/AppBar";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import { EnvBadge } from "@/app/components/EnvBadge";
import { LogoutButton } from "@/app/components/LogoutButton";
import { DashboardBreadcrumbs } from "./Breadcrumbs";

// 투명 AppBar — 페이지 상단에 브레드크럼 + 환경 배지 + 로그아웃.
// 사이드바가 left margin 을 차지하므로 AppBar position 은 static 으로 유지 (페이지 컨텐츠 위에).

export function DashboardAppBar() {
  return (
    <MuiAppBar
      position="static"
      elevation={0}
      color="transparent"
      sx={{
        backgroundColor: "transparent",
        backgroundImage: "none",
        boxShadow: "none",
        mb: 2,
      }}
    >
      <Toolbar disableGutters sx={{ minHeight: 56, px: { xs: 1, md: 0 } }}>
        <Box sx={{ flex: 1, minWidth: 0, pl: { xs: 6, md: 0 } }}>
          <DashboardBreadcrumbs />
        </Box>
        <Stack direction="row" spacing={1.5} alignItems="center">
          <EnvBadge />
          <LogoutButton variant="icon" />
        </Stack>
      </Toolbar>
    </MuiAppBar>
  );
}
