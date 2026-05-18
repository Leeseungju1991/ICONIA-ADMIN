import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import { gradients } from "@/app/(theme)/tokens";

// Material Dashboard React 의 stat card — 컬러 그라데이션 아이콘 블록이
// 카드 상단에서 negative top margin 으로 튀어나오는 시그니처 형태.

export type StatCardColor = "primary" | "info" | "success" | "warning" | "error" | "dark";

export type StatCardProps = {
  title: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  color?: StatCardColor;
};

export function StatCard({ title, value, sub, icon, color = "info" }: StatCardProps) {
  const grad = gradients[color];
  return (
    <Card sx={{ pt: 1, position: "relative" }}>
      <Box
        sx={{
          width: 64,
          height: 64,
          borderRadius: 2,
          background: `linear-gradient(195deg, ${grad.from}, ${grad.to})`,
          color: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 4px 20px 0 rgba(0,0,0,0.14), 0 7px 10px -5px ${grad.to}66`,
          ml: 2,
          mt: -2.5,
          mb: 1,
          position: "relative",
        }}
      >
        {icon}
      </Box>
      <Box sx={{ px: 2.5, pb: 2, textAlign: "right" }}>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
          {title}
        </Typography>
        <Typography variant="h4" sx={{ mt: 0.5, fontWeight: 700, lineHeight: 1.2 }}>
          {value}
        </Typography>
        {sub !== undefined ? (
          <Box sx={{ mt: 1.5, pt: 1.5, borderTop: "1px solid #f0f2f5" }}>
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {sub}
            </Typography>
          </Box>
        ) : null}
      </Box>
    </Card>
  );
}
