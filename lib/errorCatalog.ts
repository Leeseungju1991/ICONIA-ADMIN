// ICONIA 공통 에러 카탈로그 — 에러 처리/재시도 라운드 (2026-05-20).
//
// 정규화된 에러 코드(서버·펌웨어·앱이 보고)를 운영자가 즉시 이해할 수 있는
// 한국어 라벨 + 카테고리 + 권장 조치 + 재시도 가능 여부로 환산.
//
// 본 카탈로그는 `lib/errorMessages.ts` (운영자 인증·세션 한정) 와 별개로
// **운영 대시보드 표시용** (firmware-errors / server-errors / app-errors).
//
// 신규 코드 추가 시:
//   - Server 측 error code catalog 와 동기 (`Server/src/errorCodes.*` 류).
//   - Firmware 측 ESP32 enum (`Firmware/src/error_codes.h` 류) 과 동기.
//   - App 측 Sentry 분류 tag 와 동기.

/**
 * 최종 사용자(앱 사용자)가 본 에러를 어떻게 *체감* 하는지.
 *
 * ICONIA 공통 정책 (Router → Admin / 라운드 2, 2026-05-20):
 *   - `silent`        : 사용자는 에러 사실을 전혀 인지하지 못함 (백그라운드 재시도·서버 측 처리 등).
 *   - `in-character`  : 인형/AI 캐릭터가 자연어로 에둘러 표현 (예: "잠시 생각이 멈췄어요"). 사용자에게 *에러임*이 명시되지 않음.
 *   - `visible`       : 명확한 에러 UI (에러 화면 · 빨간 토스트 · 차단 dialog). 사용자가 "지금 뭔가 잘못되었다"고 인지.
 *
 * 운영자 정책: Admin 은 *시스템* 에러는 모두 명확히 표시(visible 정책의 운영자판). 다만 사용자에게
 * silent/in-character 로 처리된 에러도 운영 측에서는 *그대로 가시*이며, 본 필드는 사용자 측 UX 결정
 * (App / Server / Firmware 가 사용자에게 어떻게 보일지)을 *기록*만 한다.
 */
export type UserVisibility = "silent" | "in-character" | "visible";

export type ErrorEntry = {
  /** 사람이 읽기 쉬운 한국어 라벨 (대시보드 표시용). */
  label: string;
  /** 카테고리 — 필터·CSV 컬럼용. */
  category:
    | "ota"
    | "ble"
    | "wifi"
    | "battery"
    | "hardware"
    | "auth"
    | "rate-limit"
    | "upstream"
    | "infra"
    | "billing"
    | "runtime"
    | "native"
    | "storage"
    | "unknown";
  /** 운영자에게 권장하는 1차 조치. */
  recommendedAction: string;
  /** 자동 재시도 가능한 transient 에러인지. */
  retryable: boolean;
  /**
   * 사용자 인지 가시성. App/Server/Firmware 가 사용자에게 보여주는 방식을 *카탈로그에 명시*.
   * SLO 계산("사용자 인지된 에러율") 에 사용. 미정 시 `silent` 가 가장 안전한 기본값이 아니라
   * `visible` (현재 정책 미정 = 보수적으로 노출됐다고 간주) 이지만, 본 카탈로그는 모든 코드에
   * 명시값을 갖도록 강제한다.
   */
  userVisibility: UserVisibility;
  /**
   * Server `error-codes.md` (~120 ERR_*) 와의 매핑.
   *
   * Admin 카탈로그(15종)는 *운영 표시 표면* 의 거시적 묶음 — 다수의 Server canonical
   * 코드가 같은 운영자 라벨로 묶인다. 본 필드는 *그 묶음*을 명시한다:
   *
   *   - Server envelope `error.code` 가 이 list 안의 코드라면 본 entry 가 적용된다.
   *   - 길이 0 / 미정의면 별칭 매핑 없음 (펌웨어/앱 측 정규화 코드 단독).
   *
   * Reverse lookup 은 `lookupCanonical(serverCode)` 가 담당.
   *
   * 정합성 정책:
   *   - 한 Server 코드는 최대 하나의 Admin entry 에만 매핑되어야 함 (모호성 방지).
   *   - 매핑이 없는 Server 코드는 `lookupErrorCode(serverCode)` 의 unknown fallback
   *     으로 그대로 흐른다 (보수적 visible).
   */
  serverAliases?: readonly string[];
};

const CATALOG: Record<string, ErrorEntry> = {
  // ── Firmware (ESP32) ──────────────────────────────
  OTA_DOWNLOAD_FAIL: {
    label: "OTA 다운로드 실패 (Wi-Fi 끊김)",
    category: "ota",
    recommendedAction:
      "디바이스 Wi-Fi RSSI 점검 후 OTA 캠페인 재시도. 다수 발생 시 빌드 크기/CDN 점검.",
    retryable: true,
    // 사용자는 OTA 자체를 인지 못 함 (백그라운드 작업).
    userVisibility: "silent",
  },
  BLE_GATT_TIMEOUT: {
    label: "BLE 페어링 타임아웃",
    category: "ble",
    recommendedAction:
      "App 측 페어링 재시도 가이드. 펌웨어 BLE stack 회귀 확인 (1.4.x).",
    retryable: true,
    // 페어링 화면에 진행 실패가 그대로 표시.
    userVisibility: "visible",
  },
  PANIC_RTC_GPIO: {
    label: "RTC GPIO 패닉 (deep sleep 복귀 실패)",
    category: "hardware",
    recommendedAction:
      "Critical — 해당 디바이스 격리 + 펌웨어 롤백(1.4.1) 검토. 회귀 보고서 작성.",
    retryable: false,
    // 인형이 깨어나지 않으므로 사용자는 "고장" 으로 체감. 명확한 visible.
    userVisibility: "visible",
  },
  BATTERY_ADC_OUT_OF_RANGE: {
    label: "배터리 ADC 측정 이상치",
    category: "battery",
    recommendedAction:
      "단발성은 환경 noise. 다수/지속 발생 시 보정 펌웨어 배포 검토.",
    retryable: true,
    // 단발 측정 노이즈는 사용자에게 노출되지 않음.
    userVisibility: "silent",
  },
  CAM_INIT_FAIL: {
    label: "카메라 모듈 초기화 실패",
    category: "hardware",
    recommendedAction:
      "Critical — 하드웨어 결함 가능. 디바이스 RMA 안내 + 자동 재시도 가드 추가.",
    retryable: false,
    // 카메라 기능을 시도할 때만 노출, 그 외엔 silent. 보수적으로 visible.
    userVisibility: "visible",
  },

  // ── Server (AWS) ──────────────────────────────────
  PG_POOL_EXHAUSTED: {
    label: "Postgres 커넥션 풀 고갈",
    category: "infra",
    recommendedAction:
      "ai-worker / express-api 스케일 아웃 또는 풀 크기 상향. 누수 쿼리 추적.",
    retryable: true,
    // 짧은 풀 고갈은 자동 재시도로 사용자가 인지 못 함. 장기 시 페르소나 응답 지연으로 in-character.
    userVisibility: "in-character",
    // Server canonical: DB 풀 고갈은 일반적으로 ERR_DB_UNAVAILABLE / ERR_INTERNAL 로 노출.
    serverAliases: ["ERR_DB_UNAVAILABLE", "ERR_DEPENDENCY_UNAVAILABLE"],
  },
  GEMINI_GATEWAY_TIMEOUT: {
    label: "Gemini API 게이트웨이 타임아웃",
    category: "upstream",
    recommendedAction:
      "ai-worker 측 재시도 (지수 backoff). 지속 시 Google 측 상태 페이지 확인.",
    retryable: true,
    // 사용자는 "잠시 생각이 멈췄어요" 같은 character 라인으로 체감.
    userVisibility: "in-character",
    // Server canonical: LLM/vision/tts timeout + upstream/unavailable 묶음.
    serverAliases: [
      "ERR_LLM_TIMEOUT",
      "ERR_LLM_UNAVAILABLE",
      "ERR_LLM_UPSTREAM",
      "ERR_VISION_TIMEOUT",
      "ERR_VISION_PARSE",
      "ERR_TTS_TIMEOUT",
      "ERR_TTS_UNAVAILABLE",
    ],
  },
  GEMINI_RATE_LIMITED: {
    label: "Gemini 분당 호출 한도 초과",
    category: "rate-limit",
    recommendedAction:
      "App 측 throttling 강화 + persona quota 증설 요청. 단기는 자동 backoff.",
    retryable: true,
    // 사용자에겐 응답 지연으로 보여 in-character.
    userVisibility: "in-character",
    // Server canonical: 일반 rate-limit + LLM quota 묶음.
    serverAliases: ["ERR_RATE_LIMIT", "ERR_QUOTA_EXCEEDED"],
  },
  WOO_BAD_GATEWAY: {
    label: "Woo (커머스) Bad Gateway",
    category: "billing",
    recommendedAction:
      "billing-webhook 큐 재처리. 메시지가 DLQ 로 빠지면 7일 내 수동 retry.",
    retryable: true,
    // 결제 실패는 사용자에게 명확히 노출되어야 함 (PG 결과 화면).
    userVisibility: "visible",
    // Server canonical: WooCommerce 업스트림 5xx + webhook 서명 실패.
    serverAliases: [
      "ERR_WC_HTTP",
      "ERR_WC_NETWORK",
      "ERR_WC_TIMEOUT",
      "ERR_WC_UNAVAILABLE",
      "ERR_SSO_UNAVAILABLE",
      "ERR_WEBHOOK_SIGNATURE",
    ],
  },
  EFS_MOUNT_LAG: {
    label: "EFS 마운트 지연 (배포 중)",
    category: "infra",
    recommendedAction:
      "배포 직후 일시적이면 무시. 5분 이상 지속 시 EFS 헬스 + 마운트 타깃 재기동.",
    retryable: true,
    // 배포 직후 일시 503 은 클라이언트 retry 가 흡수.
    userVisibility: "silent",
    // Server canonical: 일시 점검/배포 흡수성 503 묶음 (DB 는 별 entry — PG_POOL_EXHAUSTED).
    serverAliases: ["ERR_MAINTENANCE", "ERR_S3_UPLOAD_FAILED", "ERR_S3_PRESIGN_FAILED"],
  },

  // ── App (RN Expo) ──────────────────────────────────
  JS_TypeError: {
    label: "JS TypeError (undefined 참조)",
    category: "runtime",
    recommendedAction:
      "Sentry stack frame 확인 → 해당 화면 hotfix 릴리스. RN OTA(EAS Update) 검토.",
    retryable: false,
    // RN 화면 깨짐/빈 화면으로 사용자가 명확히 인지.
    userVisibility: "visible",
  },
  Native_BLE: {
    label: "Android Native BLE (GATT 137)",
    category: "ble",
    recommendedAction:
      "기기 BT stack 이슈. App 측 재페어링 가이드 + Android 14 회귀 추적.",
    retryable: true,
    userVisibility: "visible",
  },
  Native_Audio: {
    label: "iOS Audio Session 활성화 실패",
    category: "native",
    recommendedAction:
      "백그라운드 인터럽트 충돌. App 측 권한·세션 카테고리 재확인.",
    retryable: true,
    // 음성이 안 들리면 사용자가 곧장 인지하지만, 대부분 자동 재활성화. 보수적으로 in-character.
    userVisibility: "in-character",
  },
  JS_Promise: {
    label: "Unhandled Promise rejection",
    category: "runtime",
    recommendedAction:
      "글로벌 핸들러 누락. App push 핸들러 에 try/catch 추가 후 EAS Update.",
    retryable: false,
    // 푸시 핸들러 류 — 사용자가 직접 인지하지 못 함 (백그라운드).
    userVisibility: "silent",
  },
  Native_Storage: {
    label: "기기 저장공간 부족 (MMKV 쓰기 실패)",
    category: "storage",
    recommendedAction:
      "사용자 측 디스크 정리 안내. App 측 캐시 정리 액션 노출 검토.",
    retryable: true,
    // 저장공간 부족 안내가 사용자에게 그대로 노출.
    userVisibility: "visible",
  },
};

const DEFAULT_LABEL = "알 수 없는 에러";

// 역방향 인덱스: Server canonical code → Admin catalog code.
// `serverAliases` 에 등재된 모든 코드를 펼쳐 단일 lookup 으로 환원.
// 같은 Server 코드가 두 entry 에 등재되면 *마지막 entry* 가 이긴다 — 본 정책은
// CATALOG 정의 시점에 위반 시 즉시 발견될 수 있도록 `validateAliasUniqueness()`
// 가 테스트에서 검증한다.
const ALIAS_INDEX: Record<string, string> = (() => {
  const idx: Record<string, string> = {};
  for (const [code, entry] of Object.entries(CATALOG)) {
    for (const alias of entry.serverAliases ?? []) {
      idx[alias] = code;
    }
  }
  return idx;
})();

/**
 * Server canonical code (`ERR_*`) → Admin catalog code.
 *
 * 매핑이 없으면 null. 호출자는 null 시 원본 코드 그대로 표시하거나 unknown fallback
 * 을 사용한다.
 */
export function lookupCanonical(serverCode: string): string | null {
  if (!serverCode) return null;
  return ALIAS_INDEX[serverCode] ?? null;
}

/**
 * 카탈로그 alias 의 충돌(같은 Server 코드가 두 entry 에 등재) 여부 검증.
 * 테스트가 호출 — 충돌이 있으면 [serverCode, [admin1, admin2]] 배열 반환.
 */
export function validateAliasUniqueness(): Array<[string, string[]]> {
  const seen: Record<string, string[]> = {};
  for (const [code, entry] of Object.entries(CATALOG)) {
    for (const alias of entry.serverAliases ?? []) {
      seen[alias] ??= [];
      seen[alias].push(code);
    }
  }
  return Object.entries(seen).filter(([, owners]) => owners.length > 1);
}

/** 정규화된 코드 → 운영자 친화 라벨. Server canonical 도 alias 통해 환원. fallback 은 코드 그대로. */
export function operatorLabelForCode(code: string): string {
  if (!code) return DEFAULT_LABEL;
  const direct = CATALOG[code];
  if (direct) return direct.label;
  const aliased = lookupCanonical(code);
  if (aliased) return CATALOG[aliased]!.label;
  return code;
}

/**
 * 카탈로그 entry 조회 — 없으면 alias 통해 재시도, 그래도 없으면 기본값.
 *
 * 호출 순서:
 *   1) CATALOG[code]   — Admin display code 직접 매치.
 *   2) ALIAS_INDEX[code] — Server canonical 을 Admin code 로 환원.
 *   3) unknown fallback (`userVisibility: visible`, `retryable: false`).
 */
export function lookupErrorCode(code: string): ErrorEntry {
  const direct = CATALOG[code];
  if (direct) return direct;
  const aliased = lookupCanonical(code);
  if (aliased) return CATALOG[aliased]!;
  return {
    label: code || DEFAULT_LABEL,
    category: "unknown",
    recommendedAction: "에러 코드를 카탈로그에 등록한 뒤 재분류 필요.",
    retryable: false,
    // 미분류 코드는 보수적으로 visible — 운영자가 사용자 인지 가능성을 의식하도록.
    userVisibility: "visible",
  };
}

/** 모든 카탈로그 entry — 카탈로그 자체 페이지 / 검증 테스트용. */
export function allErrorCodes(): Array<{ code: string } & ErrorEntry> {
  return Object.entries(CATALOG).map(([code, entry]) => ({ code, ...entry }));
}

/** category → 한국어 라벨 (UI chip 표시용). */
export const CATEGORY_LABEL: Record<ErrorEntry["category"], string> = {
  ota: "OTA",
  ble: "BLE",
  wifi: "Wi-Fi",
  battery: "배터리",
  hardware: "하드웨어",
  auth: "인증",
  "rate-limit": "Rate-limit",
  upstream: "외부 API",
  infra: "인프라",
  billing: "결제",
  runtime: "런타임",
  native: "네이티브",
  storage: "저장공간",
  unknown: "미분류",
};

/** userVisibility → 한국어 라벨 (UI chip 표시용). */
export const USER_VISIBILITY_LABEL: Record<UserVisibility, string> = {
  silent: "사용자 인지 없음",
  "in-character": "캐릭터 라인으로 완충",
  visible: "사용자 인지",
};

/** userVisibility → chip className (UI 일관성용). */
export const USER_VISIBILITY_CHIP: Record<UserVisibility, string> = {
  silent: "chip chip-muted",
  "in-character": "chip chip-info",
  visible: "chip chip-warn",
};

/**
 * 본 카탈로그의 모든 코드를 *모집단* 으로 가정하고, "사용자 인지된" (visible) 비율을 반환.
 * SLO 카드에서 카탈로그 자체의 정책 분포를 보여줄 때 사용.
 *
 * 주의: 실시간 에러 발생 가중치가 반영된 SLO 는 별개 — `/dashboard/stats` 의
 * mockUserPerceivedErrorRate 시계열을 사용. 본 함수는 *정책 분포* 의 정적 수치.
 */
export function userVisibleShareOfCatalog(): number {
  const all = allErrorCodes();
  if (all.length === 0) return 0;
  const visible = all.filter((e) => e.userVisibility === "visible").length;
  return visible / all.length;
}
