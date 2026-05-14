import { loadIconiaEnv, type IconiaEnvName } from "@/lib/env";

// 환경 배지 — 운영자가 prod/staging/dev 콘솔을 한눈에 구분 (P0 §5.1.10a / 감사 §2.12).
//   production → 빨강 "PROD"
//   staging    → 노랑 "STG"
//   development → 회색 "DEV"
// dashboard layout 상단 + login 화면에 동시 노출.

const LABELS: Record<IconiaEnvName, string> = {
  production: "PROD",
  staging: "STG",
  development: "DEV",
};

// globals.css 의 badge ok/warn/err 토큰을 그대로 활용 — 추가 CSS 없이 일관 색상.
const TONES: Record<IconiaEnvName, string> = {
  production: "badge err",
  staging: "badge warn",
  development: "badge muted",
};

export function EnvBadge({ env }: { env?: IconiaEnvName } = {}) {
  const resolved = env ?? loadIconiaEnv();
  return (
    <span
      className={TONES[resolved]}
      role="status"
      aria-label={`현재 환경: ${LABELS[resolved]}`}
      title={`ICONIA_ENV=${resolved}`}
      data-testid="env-badge"
    >
      {LABELS[resolved]}
    </span>
  );
}
