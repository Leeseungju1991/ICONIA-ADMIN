import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import { LoginForm } from "@/app/components/LoginForm";
import { EnvBadge } from "@/app/components/EnvBadge";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage:
          "linear-gradient(195deg, rgba(73,163,241,0.85), rgba(26,115,232,0.85)), url(data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='40' height='40'><rect width='40' height='40' fill='%23f0f2f5'/></svg>)",
        backgroundColor: "background.default",
        p: 3,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 400, p: 0, boxShadow: "0 23px 45px -11px rgba(0,0,0,0.25)" }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 0.5 }}>
            <Typography variant="h5" component="h1" sx={{ fontWeight: 700 }}>
              ICONIA 운영 콘솔
            </Typography>
            <EnvBadge />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            운영자 계정으로 로그인하세요.
          </Typography>
          <LoginForm reason={searchParams?.reason} />
        </CardContent>
      </Card>
    </Box>
  );
}
