import { z } from "zod";

// ──────────────────────────────────────────────────────────────────────
// DEPLOY_TARGET — localhost ↔ AWS 단일 토글 (★ 운영 핵심)
//
//   .env / 배포 환경에서 이 한 줄만 바꾸면 전체 환경이 전환된다:
//
//       DEPLOY_TARGET=local   →  로컬 개발 (localhost:8080 Server, 쿠키 비-Secure, DEV 배지)
//       DEPLOY_TARGET=aws     →  AWS 운영  (실 Server URL, 쿠키 Secure, PROD 배지, HSTS)
//
//   개별 변수(ICONIA_SERVER_URL / ICONIA_ENV / COOKIE_SECURE)를 따로 만지지 않아도
//   DEPLOY_TARGET 하나가 전부를 일관되게 결정한다. 개별 변수는 "선택적 override" 로만
//   남겨 두어, 토글 기본값을 깨지 않으면서 특수 케이스(예: staging)에 대응한다.
//
//   우선순위:  명시적 개별 변수 > DEPLOY_TARGET 프리셋 > 안전 기본값(local).
// ──────────────────────────────────────────────────────────────────────

export type DeployTarget = "local" | "aws";

const deployTargetSchema = z.enum(["local", "aws"]);

// 토글별 프리셋 — local / aws 두 갈래의 운영 기본값을 한 곳에 모은다.
type DeployPreset = {
  serverUrl: string;
  iconiaEnv: IconiaEnvName;
  cookieSecure: boolean;
};

const DEPLOY_PRESETS: Record<DeployTarget, DeployPreset> = {
  // 로컬: 개발자가 `npm run dev` 로 띄운 ICONIA-SERVER (Express, 기본 8080).
  local: {
    serverUrl: "http://localhost:8080",
    iconiaEnv: "development",
    cookieSecure: false,
  },
  // AWS: 실 운영 Server. URL 은 환경별로 다르므로 ICONIA_SERVER_URL override 필수.
  // override 누락 시 loadEnv() 가 명확한 에러로 배포 실수를 조기 차단한다.
  aws: {
    serverUrl: "",
    iconiaEnv: "production",
    cookieSecure: true,
  },
};

/**
 * DEPLOY_TARGET 토글 값을 읽는다. 미설정 시 `local` (안전 기본값 — 운영 데이터
 * 오접속 방지). 잘못된 값이면 즉시 throw 하여 배포 실수를 조기 차단한다.
 */
export function loadDeployTarget(): DeployTarget {
  const raw = process.env.DEPLOY_TARGET;
  if (!raw) return "local";
  const parsed = deployTargetSchema.safeParse(raw.trim().toLowerCase());
  if (!parsed.success) {
    throw new Error(
      `DEPLOY_TARGET must be one of local|aws; got "${raw}"`,
    );
  }
  return parsed.data;
}

// ICONIA_ENV — 운영자가 prod/staging/dev 콘솔을 시각적으로 구분하기 위한
// 환경 식별자 (§2.12 / 감사 §5.1.10a). NODE_ENV 와 별개로 운영 환경을 명시.
// 누락 시 DEPLOY_TARGET 프리셋으로 추론.
export type IconiaEnvName = "development" | "staging" | "production";

const iconiaEnvSchema = z.enum(["development", "staging", "production"]);

export type AdminEnv = {
  ICONIA_SERVER_URL: string;
  COOKIE_SECURE: boolean;
  ICONIA_ENV: IconiaEnvName;
  DEPLOY_TARGET: DeployTarget;
};

export function loadEnv(): AdminEnv {
  const target = loadDeployTarget();
  const preset = DEPLOY_PRESETS[target];

  // ICONIA_SERVER_URL — 명시값 우선, 없으면 토글 프리셋. aws 프리셋은 빈 문자열이라
  // override 가 없으면 아래에서 명확한 에러로 떨어진다.
  const raw = process.env.ICONIA_SERVER_URL?.trim() || preset.serverUrl;
  if (!raw) {
    throw new Error(
      `ICONIA_SERVER_URL is required when DEPLOY_TARGET=${target} ` +
        `(aws 토글은 실 Server URL override 가 필요합니다)`,
    );
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
  // aws 토글에서 평문 http Server URL 은 운영 데이터를 평문 전송하는 사고이므로 차단.
  if (target === "aws" && parsed.protocol !== "https:") {
    throw new Error(
      `DEPLOY_TARGET=aws requires an https ICONIA_SERVER_URL; got ${raw}`,
    );
  }
  const normalized = raw.replace(/\/+$/, "");

  return {
    ICONIA_SERVER_URL: normalized,
    // COOKIE_SECURE — 토글 프리셋 우선. NODE_ENV=production 이면 강제 true (이중 안전).
    COOKIE_SECURE: preset.cookieSecure || process.env.NODE_ENV === "production",
    ICONIA_ENV: loadIconiaEnv(),
    DEPLOY_TARGET: target,
  };
}

// 별도 export — layout/page 에서 server URL 검증 비용 없이 env 만 읽기 위한 헬퍼.
// 우선순위: 명시적 ICONIA_ENV > DEPLOY_TARGET 프리셋 > NODE_ENV fallback.
export function loadIconiaEnv(): IconiaEnvName {
  const raw = process.env.ICONIA_ENV;
  if (raw) {
    const parsed = iconiaEnvSchema.safeParse(raw);
    if (parsed.success) return parsed.data;
    throw new Error(
      `ICONIA_ENV must be one of development|staging|production; got "${raw}"`,
    );
  }
  // ICONIA_ENV 미설정 시 DEPLOY_TARGET 프리셋으로 추론 (local→development, aws→production).
  return DEPLOY_PRESETS[loadDeployTarget()].iconiaEnv;
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
