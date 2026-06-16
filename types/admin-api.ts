// 2026-05-27 — Admin ↔ Server 신규 endpoint 계약 (◈1번 / ◈6번 라운드).
//
// 다른 에이전트가 동시에 `2. SERVER` 에 다음 라우트를 추가하는 중이다. Admin 은
// 응답이 빈 상태(`{ items: [] }`)로 와도 깨지지 않게 UI 만 만들고 — 실제 스키마는
// 서버가 채워나가면 본 파일을 한 곳만 수정하면 모든 페이지에 전파된다.
//
// 원칙:
//   - 모든 list 응답은 `{ items: T[] }` (cursor 페이지네이션이 들어오면
//     `next_cursor: string | null` 만 추가).
//   - 시간은 ISO8601 문자열 (UTC, Z 접미사). 클라이언트는 Intl 로 KST 표시.
//   - 금액/숫자는 number (cents/usd 등 단위는 필드명에 명시).
//   - 비밀(키 평문, 토큰)은 절대 응답에 포함하지 않는다 — 운영 콘솔도 read-only.

// ---------------------------------------------------------------------------
// ◈1번 — Gemini API Key 사용량
//   GET /api/admin/gemini/keys
//   GET /api/admin/gemini/usage?range=24h|7d|30d
//   GET /api/admin/gemini/quota-alerts
// ---------------------------------------------------------------------------

/**
 * 운영 콘솔에 노출되는 Gemini API Key 메타. 키 평문은 절대 포함하지 않는다.
 * `label` 은 사람이 알아볼 수 있는 별칭 (예: "prod-1", "fallback").
 * `tier` 는 Google AI Studio 의 무료/유료 등급 — 한도 계산용.
 */
export type GeminiKeyTier = "free" | "tier1" | "tier2" | "tier3";

export type GeminiKeyRow = {
  /** 키 자체의 안정적인 ID — 클라이언트가 추적용. */
  id: string;
  /** 운영자 친화 라벨. 평문 키 노출 금지. */
  label: string;
  /** 마지막 4자 (식별 보조) — `…AB12`. */
  last4: string;
  tier: GeminiKeyTier;
  status: "active" | "cooling_down" | "disabled" | "exhausted";
  /** 24시간 누적 — 요청 수. */
  requests_24h: number;
  /** 24시간 누적 — 토큰 수 (prompt + completion 합산). */
  tokens_24h: number;
  /** 이번 달 누적 — 요청 수. */
  requests_mtd: number;
  /** 이번 달 누적 — 토큰 수. */
  tokens_mtd: number;
  /** Tier 한도 (요청/일). Free tier 의 경우 `requests_daily_limit=1500` 등. */
  requests_daily_limit: number | null;
  /** Tier 한도 (토큰/일). */
  tokens_daily_limit: number | null;
  /**
   * 일일 한도 대비 사용량 (0~1). server 가 max(requests_24h/limit,
   * tokens_24h/limit) 로 산출. 80%/95% 도달 키는 UI 빨강 강조 + 구매 권장.
   */
  usage_ratio_24h: number;
  /** 마지막 호출 시각. */
  last_used_at: string | null;
  /**
   * 운영자 메모 (note). server 의 PUT /keys/:alias/quota 가 받은 raw 문자열을
   * 그대로 노출. 2026-06-02 이전 데이터에는 `__models__={...}` prefix 가 포함될 수
   * 있어 ADMIN UI 는 `models` 컬럼이 비어있을 때 폴백 디코딩을 시도한다.
   */
  note?: string | null;
  /**
   * 2026-06-02 — 카테고리별 모델 매핑 (server 정식 컬럼).
   * server PUT /api/v1/admin/gemini/keys/:alias/quota 가 body.models 를 정식 컬럼으로
   * 받아 GET 응답에도 포함시킨다. 신규 서버 배포 이전에는 응답에 없을 수 있어 optional.
   * 그 경우 ADMIN UI 는 `decodeModelsFromNote(note)` 폴백으로 호환성 유지.
   */
  models?: {
    text?: string | null;
    image?: string | null;
    diary?: string | null;
    tts?: string | null;
    stt?: string | null;
  } | null;
};

export type GeminiKeysResponse = {
  items: GeminiKeyRow[];
};

/**
 * 시계열 포인트 — `/usage?range=24h|7d|30d` 의 응답. server 가 1시간(24h)/
 * 1일(7d/30d) bucket 으로 미리 집계. 비어있으면 `points: []`.
 */
export type GeminiUsagePoint = {
  /** Bucket 시작 ISO8601. */
  at: string;
  /** 호출 수. */
  requests: number;
  /** 토큰 (prompt + completion). */
  tokens: number;
  /** 추정 비용 (USD). server 가 model price table 로 산출. 없으면 0. */
  cost_usd: number;
};

export type GeminiModelShare = {
  model: string;
  requests: number;
  tokens: number;
  cost_usd: number;
};

export type GeminiUsageResponse = {
  range: "24h" | "7d" | "30d";
  points: GeminiUsagePoint[];
  by_model: GeminiModelShare[];
  total_requests: number;
  total_tokens: number;
  total_cost_usd: number;
};

export type GeminiQuotaAlert = {
  id: string;
  key_id: string;
  key_label: string;
  ratio: number; // 0.8 / 0.95 / 1.0
  level: "warn" | "critical" | "exhausted";
  opened_at: string;
  closed_at: string | null;
};

export type GeminiQuotaAlertsResponse = {
  items: GeminiQuotaAlert[];
};

// ---------------------------------------------------------------------------
// ◈6번 — 신고/모더레이션 통합
//   GET /api/admin/reports?status=open|resolved&kind=post|comment|review|user
// ---------------------------------------------------------------------------

export type ReportTargetKind = "post" | "comment" | "review" | "user";
export type ReportStatus = "open" | "resolved" | "dismissed";

export type ReportRow = {
  id: string;
  target_kind: ReportTargetKind;
  target_id: string;
  target_excerpt: string | null;
  /** 가장 흔한 사유 (욕설/혐오/스팸/도용/기타). */
  reason: string;
  /** 동일 타깃에 대한 누적 신고 수. */
  reported_count: number;
  status: ReportStatus;
  /** 마지막 신고 시각. */
  last_reported_at: string;
  /** 운영자가 이미 조치를 시작한 경우. */
  in_progress_by: string | null;
};

export type ReportsResponse = {
  items: ReportRow[];
  next_cursor: string | null;
  /** status="open" 전체 카운트 — 사이드바 배지/대시보드 카드용. */
  total_open: number;
};

export type ReportAction = "hide" | "remove" | "suspend_user" | "dismiss";

// ---------------------------------------------------------------------------
// ◈6번 — 오류 추적 (FW / Server / AI / APP)
//   GET /api/admin/errors?domain=firmware|server|ai|app&since=ISO
// ---------------------------------------------------------------------------

export type ErrorDomain = "firmware" | "server" | "ai" | "app";

export type ErrorRow = {
  id: string;
  domain?: ErrorDomain;
  /** 정규화된 그룹 키 (스택 fingerprint). */
  fingerprint: string;
  /** 사람 친화적 메시지 — 한 줄 요약. */
  message: string;
  /** 전체 스택 (legacy). server 정본은 stack_excerpt. */
  stack?: string | null;
  /** server 정본 — 스택 일부 (PII 마스킹 후). */
  stack_excerpt?: string | null;
  /** 24h 내 발생 빈도 (legacy). server 정본은 sample_count. */
  count_24h?: number;
  /** server 정본 — 누적 샘플 수. */
  sample_count?: number;
  /** 영향 받은 고유 사용자 수 (서버 미반환 가능 — optional). */
  affected_users?: number;
  first_seen_at: string;
  last_seen_at: string;
  /** server / fw / ai 도메인의 기여 컴포넌트 (e.g. "auth-service", "v1.4.2"). */
  source: string | null;
  severity: "low" | "medium" | "high" | "critical" | "info" | "warn" | "error" | "fatal";
  /** server 정본 ErrorEvent.status — open|acknowledged|resolved. */
  status?: "open" | "acknowledged" | "in_progress" | "resolved" | null;
  /** acknowledged 전이 시각 (fallback 계산용). */
  acknowledged_at?: string | null;
  /** resolved 전이 시각 (fallback 계산용). */
  resolved_at?: string | null;
};

export type ErrorsResponse = {
  items: ErrorRow[];
  next_cursor: string | null;
};

// ---------------------------------------------------------------------------
// ◈6번 — OTA 펌웨어 업로드/배포
//   POST /api/admin/ota/firmwares           → presigned PUT URL 반환
//   POST /api/admin/ota/firmwares/:id/register  → 업로드 완료 후 메타 등록
//   POST /api/admin/ota/rollouts            → 디바이스 그룹 선택 후 배포 시작
//   GET  /api/admin/ota/device-groups       → 배포 대상 group 목록
// ---------------------------------------------------------------------------

export type OtaPresignRequest = {
  filename: string;
  size_bytes: number;
  sha256: string;
  version: string;
  channel: "stable" | "beta" | "canary" | "dev";
  notes?: string;
};

export type OtaPresignResponse = {
  /** 업로드용 S3 presigned PUT URL. */
  upload_url: string;
  /** server-side firmware row id (등록 step 에서 사용). */
  firmware_id: string;
  /** 업로드 완료 후 호출할 register endpoint path. */
  register_path: string;
};

export type OtaDeviceGroup = {
  id: string;
  label: string;
  device_count: number;
};

export type OtaRolloutRequest = {
  firmware_id: string;
  group_ids: string[];
  /** canary % (0~100). 미지정 시 server 기본값. */
  canary_percent?: number;
  notes?: string;
};

export type OtaRolloutResponse = {
  rollout_id: string;
  state: "queued" | "rolling";
};

// ---------------------------------------------------------------------------
// ◈6번 — 공지/알람 작성 (앱푸시 + 인앱 배너)
//   POST /api/admin/notifications
//   현재 서버 라우트 미구현 — Admin 은 호출만 작성, 빈상태 fallback.
// ---------------------------------------------------------------------------

export type NotificationChannel = "push" | "in_app_banner";
export type NotificationAudienceKind = "all" | "user_segment" | "device_group";

export type NotificationCreate = {
  title: string;
  body: string;
  /** 채널 — 최소 1개 선택. */
  channels: NotificationChannel[];
  audience_kind: NotificationAudienceKind;
  /** user_segment / device_group 일 때 ID 목록. all 일 때 빈 배열. */
  audience_ids: string[];
  /** 예약 발송. 즉시 발송이면 null. */
  scheduled_at?: string | null;
};

export type NotificationCreated = {
  id: string;
  status: "queued" | "scheduled" | "sent";
};

// ---------------------------------------------------------------------------
// [차단 사용자] — 특정 사용자의 차단 목록 조회 + 개별 차단 해제
//   GET  /api/v1/admin/users/:userId/blocked-users?query=&sort=created_at|display_name
//   POST /api/v1/admin/users/:userId/unblock  body={target_user_id}
// (cf. APP GET /api/v1/me/blocks 와 동일 계약 — 차단 대상(target)의 메타 노출.)
// ---------------------------------------------------------------------------

/** 차단 목록 정렬 키 — 차단 시각(최신순) 또는 대상 표시 이름(가나다순). */
export type BlockedUserSort = "created_at" | "display_name";

/** 한 건의 차단 — 대상(target) 사용자의 식별/표시 메타 + 차단 시각. */
export type BlockedUserRow = {
  /** 차단 대상 사용자의 ID. unblock 시 target_user_id 로 전달. */
  target_user_id: string;
  /** 대상 표시 이름 (없으면 빈 문자열일 수 있음). */
  display_name: string;
  /** 대상 이메일 (마스킹된 형태로 올 수 있음). */
  email?: string | null;
  /** 대상 아바타 URL — 없으면 null. */
  avatar_url?: string | null;
  /** 차단한 시각 (ISO8601). */
  created_at: string;
};

export type BlockedUsersResponse = {
  items: BlockedUserRow[];
  next_cursor?: string | null;
};

// ---------------------------------------------------------------------------
// [Feature Flag — 사용자별] — 특정 사용자의 기능 플래그 override 조회 + 토글
//   GET   /api/v1/admin/users/:userId/feature-flags  -> { flags: [{flag_key, enabled}] }
//   PATCH /api/v1/admin/users/:userId/feature-flags  body={flag_key, enabled}
//                                                     -> {flag_key, enabled}
// (cf. APP GET /api/v1/me/feature-flags -> {flags:{[key]:boolean}} — 빌드타임 flags 와 머지.)
// 알려진 flag_key 목록은 서버 상수(feed/doll/mypage/commerce/rag 등 빌드 플래그 키와 정렬).
// ---------------------------------------------------------------------------

/** 서버 상수와 정렬된 알려진 feature flag 키 (빌드타임 flags 와 동일 네이밍). */
export const KNOWN_FEATURE_FLAG_KEYS = [
  "feed",
  "doll",
  "mypage",
  "commerce",
  "rag",
] as const;

export type FeatureFlagKey = (typeof KNOWN_FEATURE_FLAG_KEYS)[number] | string;

/** 한 건의 사용자별 flag override — flag_key 와 enabled 불리언. */
export type UserFeatureFlagRow = {
  flag_key: FeatureFlagKey;
  enabled: boolean;
};

export type UserFeatureFlagsResponse = {
  flags: UserFeatureFlagRow[];
};

// ---------------------------------------------------------------------------
// Result envelope (Admin server actions 가 공통으로 반환).
// ---------------------------------------------------------------------------

export type AdminResult<T> =
  | { ok: true; data: T }
  | { ok: false; code?: string; message: string; unreachable?: boolean };
