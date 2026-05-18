import { redirect } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { MfaForm } from "@/app/components/MfaForm";

export default function MfaPage({
  searchParams,
}: {
  searchParams: { token?: string };
}) {
  const token = searchParams?.token;
  if (!token) {
    redirect("/login?reason=mfa_expired");
  }
  return (
    <Box
      component="main"
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage:
          "linear-gradient(195deg, rgba(73,163,241,0.85), rgba(26,115,232,0.85))",
        backgroundColor: "background.default",
        p: 3,
      }}
    >
      <Card sx={{ width: "100%", maxWidth: 400, boxShadow: "0 23px 45px -11px rgba(0,0,0,0.25)" }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: 700, mb: 0.5 }}>
            2단계 인증
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            앱의 6자리 코드를 입력하거나, 복구 코드로 로그인할 수 있습니다.
          </Typography>
          <MfaForm token={token!} />
        </CardContent>
      </Card>
    </Box>
  );
}
