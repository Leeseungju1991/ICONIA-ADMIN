import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────
// 데이터 연결 대상 — AWS 실서버 단일 연결 (★ 운영 핵심)
//
//   Admin 웹은 오직 AWS 실서버(ICONIA-SERVER) 에만 연결한다. 로컬/LAN 백엔드
//   연결 개념(local 토글 / localhost 백엔드 등)은 완전히 제거되었다.
//
//   기본 데이터 대상은 아래 AWS ALB 한 곳뿐이다. 운영 환경에서 도메인/HTTPS 가
//   준비되면 ICONIA_SERVER_URL env 로 override 한다 (env override 가 우선).
// ──────────────────────────────────────────────────────────────────────

// AWS 실서버 정본 base URL (단일 데이터 대상). env override 가 없으면 항상 이 값.
const AWS_SERVER_URL =
  "http://iconia-prod-alb-1600486872.ap-northeast-2.elb.amazonaws.com";

// ICONIA_ENV — 운영자가 prod/staging/dev 콘솔을 시각적으로 구분하기 위한
// 환경 식별자 (§2.12 / 감사 §5.1.10a). NODE_ENV 와 별개로 운영 환경을 명시.
// 누락 시 production (AWS 실서버 단일 연결).
export type IconiaEnvName = "development" | "staging" | "production";

const iconiaEnvSchema = z.enum(["development", "staging", "production"]);

export type AdminEnv = {
  ICONIA_SERVER_URL: string;
  COOKIE_SECURE: boolean;
  ICONIA_ENV: IconiaEnvName;
};

export function loadEnv(): AdminEnv {
  // ICONIA_SERVER_URL — 명시값(override) 우선, 없으면 AWS 실서버 ALB 기본값.
  const raw = process.env.ICONIA_SERVER_URL?.trim() || AWS_SERVER_URL;
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
    // COOKIE_SECURE — 기본 true (운영). NODE_ENV=production 이면 강제 true (이중 안전).
    // COOKIE_SECURE_OVERRIDE=false 로 PoC HTTP 환경 (도메인+HTTPS 미보유) 회피 가능.
    COOKIE_SECURE: process.env.COOKIE_SECURE_OVERRIDE === "false"
      ? false
      : true,
    ICONIA_ENV: loadIconiaEnv(),
  };
}

// 별도 export — layout/page 에서 server URL 검증 비용 없이 env 만 읽기 위한 헬퍼.
// 우선순위: 명시적 ICONIA_ENV > production 기본값.
export function loadIconiaEnv(): IconiaEnvName {
  const raw = process.env.ICONIA_ENV;
  if (raw) {
    const parsed = iconiaEnvSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    throw new Error(
      `ICONIA_ENV must be one of development|staging|production; got "${raw}"`,
    );
  }
  // ICONIA_ENV 미설정 시 production (AWS 실서버 단일 연결).
  return "production";
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

// 2026-06-09 ROLLBACK — loadGeminiKeyStorePath() 제거.
// admin 이 평문 사용자 키를 다루는 키 스토어 경로 의존성 폐기.
// per-user 키는 APP Settings 에서 입력 → 2. SERVER 가 KEK 로 암호화해
// user_gemini_key Postgres 테이블에 보관한다. admin 콘솔은 env-pooled 키
// 메타데이터만 관리.
