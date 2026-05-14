import { z } from "zod";

// ICONIA_ENV — 운영자가 prod/staging/dev 콘솔을 시각적으로 구분하기 위한
// 환경 식별자 (§2.12 / 감사 §5.1.10a). NODE_ENV 와 별개로 운영 환경을 명시.
// 누락 시 NODE_ENV 기반 추론 ("production" → production, 그 외 → development).
export type IconiaEnvName = "development" | "staging" | "production";

const iconiaEnvSchema = z.enum(["development", "staging", "production"]);

export type AdminEnv = {
  ICONIA_SERVER_URL: string;
  COOKIE_SECURE: boolean;
  ICONIA_ENV: IconiaEnvName;
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
    ICONIA_ENV: loadIconiaEnv(),
  };
}

// 별도 export — layout/page 에서 server URL 검증 비용 없이 env 만 읽기 위한 헬퍼.
// 실패 시 default 로 development (CI/test 안전성).
export function loadIconiaEnv(): IconiaEnvName {
  const raw = process.env.ICONIA_ENV;
  if (raw) {
    const parsed = iconiaEnvSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    throw new Error(
      `ICONIA_ENV must be one of development|staging|production; got "${raw}"`,
    );
  }
  // ICONIA_ENV 미설정 시 NODE_ENV 로 fallback (legacy 호환).
  return process.env.NODE_ENV === "production" ? "production" : "development";
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
