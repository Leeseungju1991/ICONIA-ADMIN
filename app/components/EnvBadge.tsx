import Chip from "@mui/material/Chip";
import { loadIconiaEnv, type IconiaEnvName } from "@/lib/env";

// 환경 배지 — 운영자가 prod/staging/dev 콘솔을 한눈에 구분 (P0 §5.1.10a / 감사 §2.12).
//   production → 빨강 "PROD"
//   staging    → 노랑 "STG"
//   development → 회색 "DEV"
// MUI Chip 으로 재스킨. role/aria/data-testid 보존 — 테스트 호환.

const LABELS: Record<IconiaEnvName, string> = {
  production: "PROD",
  staging: "STG",
  development: "DEV",
};

type ChipColor = "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
type ChipVariant = "filled" | "outlined";

const STYLES: Record<IconiaEnvName, { color: ChipColor; variant: ChipVariant }> = {
  production: { color: "error", variant: "filled" },
  staging: { color: "warning", variant: "filled" },
  development: { color: "default", variant: "outlined" },
};

export function EnvBadge({ env }: { env?: IconiaEnvName } = {}) {
  const resolved = env ?? loadIconiaEnv();
  const { color, variant } = STYLES[resolved];
  return (
    <Chip
      label={LABELS[resolved]}
      color={color}
      variant={variant}
      size="small"
      role="status"
      aria-label={`현재 환경: ${LABELS[resolved]}`}
      title={`ICONIA_ENV=${resolved}`}
      data-testid="env-badge"
      sx={{ fontWeight: 700, letterSpacing: "0.5px" }}
    />
  );
}
