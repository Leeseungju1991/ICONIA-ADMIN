import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import LogoutOutlined from "@mui/icons-material/LogoutOutlined";
import { logoutAction } from "@/lib/actions/logout";

// LogoutButton — server component (form action 직접 호출).
// 두 가지 표시 모드:
//   - default ("button"): 사이드바 footer 의 outlined 텍스트 버튼
//   - "icon": AppBar 우측의 IconButton (Sidebar collapsed 시에도 의미 전달)
//
// 어느 모드든 `<form action={logoutAction}>` 가 외곽 — Server Action progressive enhancement 유지.

export function LogoutButton({ variant = "button" }: { variant?: "button" | "icon" }) {
  return (
    <form action={logoutAction} style={{ display: "inline-block" }}>
      {variant === "icon" ? (
        <IconButton
          type="submit"
          color="inherit"
          aria-label="로그아웃"
          title="로그아웃"
        >
          <LogoutOutlined />
        </IconButton>
      ) : (
        <Button
          type="submit"
          variant="outlined"
          size="small"
          color="inherit"
          startIcon={<LogoutOutlined fontSize="small" />}
          sx={{
            borderColor: "rgba(255,255,255,0.4)",
            color: "rgba(255,255,255,0.9)",
            "&:hover": {
              borderColor: "rgba(255,255,255,0.7)",
              backgroundColor: "rgba(255,255,255,0.06)",
            },
          }}
        >
          로그아웃
        </Button>
      )}
    </form>
  );
}
