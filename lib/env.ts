export type AdminEnv = {
  ICONIA_SERVER_URL: string;
  COOKIE_SECURE: boolean;
};

export function loadEnv(): AdminEnv {
  const raw = process.env.ICONIA_SERVER_URL;
  if (!raw) {
    throw new Error("ICONIA_SERVER_URL is required");
  }
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`ICONIA_SERVER_URL is not a valid URL: ${raw}`);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `ICONIA_SERVER_URL must be http(s); got ${parsed.protocol}`,
    );
  }
  const normalized = raw.replace(/\/+$/, "");
  return {
    ICONIA_SERVER_URL: normalized,
    COOKIE_SECURE: process.env.NODE_ENV === "production",
  };
}

// ADMIN_IDLE_TIMEOUT_MINUTES — 운영자 idle 자동 로그아웃 임계 (분).
// 기본 30 분 (감사 §5.2 #31 / SOC2 CC6.1 권고치). 5 ≤ N ≤ 480 강제.
// 누락/잘못된 값이면 default 30 사용 (장애 회피).
const DEFAULT_IDLE_TIMEOUT_MIN = 30;
const MIN_IDLE_TIMEOUT_MIN = 5;
const MAX_IDLE_TIMEOUT_MIN = 480;

export function loadIdleTimeoutMinutes(): number {
  const raw = process.env.ADMIN_IDLE_TIMEOUT_MINUTES;
  if (!raw) return DEFAULT_IDLE_TIMEOUT_MIN;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return DEFAULT_IDLE_TIMEOUT_MIN;
  if (n < MIN_IDLE_TIMEOUT_MIN) return MIN_IDLE_TIMEOUT_MIN;
  if (n > MAX_IDLE_TIMEOUT_MIN) return MAX_IDLE_TIMEOUT_MIN;
  return n;
}
