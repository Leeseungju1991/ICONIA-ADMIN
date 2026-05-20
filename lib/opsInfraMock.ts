// ICONIA Admin — 운영 안정성(Ops 9항목) mock 인프라 데이터.
//
// 라운드 (2026-05-20): observability · tracing · alerting · audit log · replay tool ·
// admin recovery action · force retry · kill switch · feature flag 9 항목을
// 단일 운영 표면(/dashboard/ops) 에서 다룰 수 있도록 mock 데이터를 제공.
//
// 백엔드 미연동 — Server 측 `/api/v1/admin/ops/*` (미정) 엔드포인트 도입 후
// 본 모듈은 `lib/adminApi.ts` 로 교체. UI 계약은 그대로 유지.

// ── 1) observability — 서비스 헬스 / SLO / 알람 대시보드 ─────────
export type HealthProbeRow = {
  id: string;
  /** 대상 서비스 / 엔드포인트. */
  service: "express-api" | "ai-worker" | "persona" | "billing-webhook" | "ble-gateway" | "ota-cdn";
  region: "KR" | "JP" | "US" | "global";
  status: "ok" | "degraded" | "down";
  latency_p50_ms: number;
  latency_p95_ms: number;
  error_rate_pct: number;
  /** 마지막 probe 시각 ISO. */
  checked_at: string;
};

export const mockHealthProbes: HealthProbeRow[] = [
  { id: "hp_001", service: "express-api", region: "KR", status: "ok", latency_p50_ms: 42, latency_p95_ms: 180, error_rate_pct: 0.4, checked_at: "2026-05-20T11:30:00Z" },
  { id: "hp_002", service: "ai-worker", region: "KR", status: "degraded", latency_p50_ms: 920, latency_p95_ms: 3100, error_rate_pct: 4.2, checked_at: "2026-05-20T11:30:00Z" },
  { id: "hp_003", service: "persona", region: "KR", status: "ok", latency_p50_ms: 380, latency_p95_ms: 1200, error_rate_pct: 1.1, checked_at: "2026-05-20T11:30:00Z" },
  { id: "hp_004", service: "billing-webhook", region: "KR", status: "ok", latency_p50_ms: 88, latency_p95_ms: 420, error_rate_pct: 0.8, checked_at: "2026-05-20T11:30:00Z" },
  { id: "hp_005", service: "ble-gateway", region: "KR", status: "ok", latency_p50_ms: 12, latency_p95_ms: 55, error_rate_pct: 0.0, checked_at: "2026-05-20T11:30:00Z" },
  { id: "hp_006", service: "ota-cdn", region: "global", status: "ok", latency_p50_ms: 110, latency_p95_ms: 480, error_rate_pct: 0.2, checked_at: "2026-05-20T11:30:00Z" },
  { id: "hp_007", service: "ai-worker", region: "JP", status: "down", latency_p50_ms: 0, latency_p95_ms: 0, error_rate_pct: 100, checked_at: "2026-05-20T11:30:00Z" },
];

// ── 3) alerting — 운영자에게 도달한 임계 도달 알람 ───────────────
export type OpsAlertRow = {
  id: string;
  /** 알람 심각도. */
  severity: "info" | "warn" | "critical";
  title: string;
  source: "slo" | "health-probe" | "error-budget" | "dead-letter" | "kill-switch" | "feature-flag";
  /** 발생 시각. */
  fired_at: string;
  /** 진정(resolved) 시각 — null 이면 활성 알람. */
  resolved_at: string | null;
  /** in-app banner · slack · email 등 발송 채널. */
  channels: Array<"in-app" | "slack" | "email">;
  /** 알람을 ack 한 운영자 — null 이면 미확인. */
  acked_by: string | null;
  body: string;
};

export const mockOpsAlerts: OpsAlertRow[] = [
  {
    id: "alr_001",
    severity: "critical",
    title: "ai-worker (JP) probe down — 5분 연속",
    source: "health-probe",
    fired_at: "2026-05-20T11:25:00Z",
    resolved_at: null,
    channels: ["in-app", "slack", "email"],
    acked_by: null,
    body: "ai-worker 도쿄 리전 헬스체크가 5회 연속 실패. ALB target group 모두 unhealthy. Auto-scale 트리거 확인 필요.",
  },
  {
    id: "alr_002",
    severity: "warn",
    title: "사용자 인지된 에러율 1.5% 초과 (오늘)",
    source: "slo",
    fired_at: "2026-05-20T10:42:00Z",
    resolved_at: null,
    channels: ["in-app", "slack"],
    acked_by: null,
    body: "user_visible / total_errors = 1.84% — 7일 SLO 목표 1.5% 초과. WOO_BAD_GATEWAY 가 주 원인.",
  },
  {
    id: "alr_003",
    severity: "warn",
    title: "dead-letter 큐 32건 적재",
    source: "dead-letter",
    fired_at: "2026-05-20T09:11:00Z",
    resolved_at: null,
    channels: ["in-app", "slack"],
    acked_by: null,
    body: "billing-webhook DLQ 에 미처리 메시지 32건. WOO_BAD_GATEWAY 대량 발생 후 자동 retry 모두 소진.",
  },
  {
    id: "alr_004",
    severity: "info",
    title: "OTA 1.4.2 stable 배포 완료",
    source: "health-probe",
    fired_at: "2026-05-20T03:00:00Z",
    resolved_at: "2026-05-20T03:00:00Z",
    channels: ["in-app"],
    acked_by: "ops@iconia.example.com",
    body: "8,420 / 12,000 대상에 적용 완료. 실패 32대 — 별도 패널 참조.",
  },
  {
    id: "alr_005",
    severity: "critical",
    title: "Gemini API 분당 호출 한도 초과 (지속)",
    source: "error-budget",
    fired_at: "2026-05-20T08:30:00Z",
    resolved_at: "2026-05-20T08:55:00Z",
    channels: ["in-app", "slack", "email"],
    acked_by: "ops@iconia.example.com",
    body: "GEMINI_RATE_LIMITED 가 분당 평균 12건 발생. ai-worker 측 throttling 자동 강화로 진정됨.",
  },
];

// ── 2) tracing — request_id / trace_id 종단간 검색 ───────────────
export type TraceEvent = {
  id: string;
  /** 분산 추적 ID — App ↔ Server ↔ AI 일관. */
  trace_id: string;
  /** 요청 ID — 단일 hop 식별자. */
  request_id: string;
  /** 발생 위치. */
  hop: "app" | "server" | "ai" | "firmware";
  /** 시작 시각 ISO. */
  started_at: string;
  duration_ms: number;
  /** HTTP status 또는 도메인 상태. */
  status: "ok" | "error";
  endpoint: string;
  /** 운영자가 펼쳐볼 raw payload (PII 마스킹된 헤더·body 요약). */
  payload_preview: string;
};

export const mockTraces: TraceEvent[] = [
  {
    id: "tr_001",
    trace_id: "trc_5f7c2e",
    request_id: "req_8a91",
    hop: "app",
    started_at: "2026-05-20T11:22:01.120Z",
    duration_ms: 4,
    status: "ok",
    endpoint: "POST /api/v1/persona/chat",
    payload_preview: '{"x-iconia-app-version":"1.8.0","device_id":"dev_aa11","persona":"lumi","prompt_chars":42}',
  },
  {
    id: "tr_002",
    trace_id: "trc_5f7c2e",
    request_id: "req_8a92",
    hop: "server",
    started_at: "2026-05-20T11:22:01.124Z",
    duration_ms: 312,
    status: "ok",
    endpoint: "POST /api/v1/persona/chat",
    payload_preview: '{"x-iconia-trace-id":"trc_5f7c2e","resolved_user":"usr_001(masked)","persona":"lumi"}',
  },
  {
    id: "tr_003",
    trace_id: "trc_5f7c2e",
    request_id: "req_8a93",
    hop: "ai",
    started_at: "2026-05-20T11:22:01.140Z",
    duration_ms: 880,
    status: "error",
    endpoint: "POST gemini-2.0-flash:generateContent",
    payload_preview: '{"upstream_status":504,"error":"GEMINI_GATEWAY_TIMEOUT","retry_attempt":1}',
  },
  {
    id: "tr_004",
    trace_id: "trc_5f7c2e",
    request_id: "req_8a94",
    hop: "ai",
    started_at: "2026-05-20T11:22:01.890Z",
    duration_ms: 720,
    status: "ok",
    endpoint: "POST gemini-2.0-flash:generateContent",
    payload_preview: '{"upstream_status":200,"tokens_out":128,"retry_attempt":2}',
  },
  {
    id: "tr_005",
    trace_id: "trc_5f7c2e",
    request_id: "req_8a95",
    hop: "server",
    started_at: "2026-05-20T11:22:02.620Z",
    duration_ms: 18,
    status: "ok",
    endpoint: "RESPONSE /api/v1/persona/chat",
    payload_preview: '{"bytes":1842,"persona":"lumi","cache":"miss"}',
  },
  {
    id: "tr_011",
    trace_id: "trc_9b40a1",
    request_id: "req_a001",
    hop: "firmware",
    started_at: "2026-05-20T10:14:00.000Z",
    duration_ms: 6_500,
    status: "error",
    endpoint: "OTA_DOWNLOAD /firmware/1.4.2.bin",
    payload_preview: '{"device":"dev_cc33","error_code":"OTA_DOWNLOAD_FAIL","wifi_rssi":-82}',
  },
  {
    id: "tr_012",
    trace_id: "trc_9b40a1",
    request_id: "req_a002",
    hop: "server",
    started_at: "2026-05-20T10:14:01.300Z",
    duration_ms: 22,
    status: "ok",
    endpoint: "POST /api/v1/devices/ota-failure",
    payload_preview: '{"device":"dev_cc33","reason":"OTA_DOWNLOAD_FAIL"}',
  },
];

// ── 5) replay tool — dead-letter 큐 ────────────────────────────
export type DeadLetterRow = {
  id: string;
  /** 원본 큐 — 화면 그룹화. */
  queue: "billing-webhook" | "push" | "ai-task" | "ota-callback";
  /** 마지막 시도 시각. */
  last_attempt_at: string;
  /** 최초 적재 시각. */
  enqueued_at: string;
  /** 자동 재시도 횟수 (큐 측). */
  retry_count: number;
  /** 마지막 실패 원인 코드 (lib/errorCatalog). */
  failure_code: string;
  /** 페이로드 크기 — 운영자가 큐 무게 가늠. */
  payload_bytes: number;
  /** 운영자가 펼쳤을 때 보일 페이로드 미리보기 (PII 마스킹된 JSON snippet). */
  payload_preview: string;
};

export const mockDeadLetters: DeadLetterRow[] = [
  {
    id: "dlq_001",
    queue: "billing-webhook",
    last_attempt_at: "2026-05-20T08:14:00Z",
    enqueued_at: "2026-05-20T07:01:00Z",
    retry_count: 5,
    failure_code: "WOO_BAD_GATEWAY",
    payload_bytes: 2_410,
    payload_preview: '{"event":"order.completed","order_id":"woo_******","amount":12000,"status":"paid"}',
  },
  {
    id: "dlq_002",
    queue: "billing-webhook",
    last_attempt_at: "2026-05-20T08:20:00Z",
    enqueued_at: "2026-05-20T07:05:00Z",
    retry_count: 5,
    failure_code: "WOO_BAD_GATEWAY",
    payload_bytes: 1_980,
    payload_preview: '{"event":"refund.created","order_id":"woo_******","amount":4500}',
  },
  {
    id: "dlq_003",
    queue: "push",
    last_attempt_at: "2026-05-12T12:00:00Z",
    enqueued_at: "2026-05-12T12:00:00Z",
    retry_count: 3,
    failure_code: "ERR_SERVER_UNAVAILABLE",
    payload_bytes: 412,
    payload_preview: '{"campaign":"psh_005","fcm_tokens":820,"reason":"APNs auth token expired"}',
  },
  {
    id: "dlq_004",
    queue: "ai-task",
    last_attempt_at: "2026-05-20T10:11:00Z",
    enqueued_at: "2026-05-20T09:45:00Z",
    retry_count: 3,
    failure_code: "GEMINI_GATEWAY_TIMEOUT",
    payload_bytes: 6_100,
    payload_preview: '{"persona":"taro","prompt_chars":1240,"user":"usr_***","retry":3}',
  },
  {
    id: "dlq_005",
    queue: "ota-callback",
    last_attempt_at: "2026-05-19T22:00:00Z",
    enqueued_at: "2026-05-19T21:50:00Z",
    retry_count: 2,
    failure_code: "EFS_MOUNT_LAG",
    payload_bytes: 320,
    payload_preview: '{"device":"dev_gg77","fw":"1.4.1","applied_at":"2026-05-19T21:55:00Z"}',
  },
];

// ── 6) recovery action — 운영자 복구 액션 카탈로그 ──────────────
export type RecoveryActionKind =
  | "ota.rollback"
  | "persona.recall"
  | "push.resend"
  | "device.reset"
  | "user.force_logout_all";

export type RecoveryActionMeta = {
  label: string;
  description: string;
  /** 마지막 실행 시각 — null 이면 본 세션에서 호출된 적 없음. */
  last_invoked_at: string | null;
  /** 강력 액션 여부 — 2단계 확인 강제. */
  destructive: boolean;
};

export const RECOVERY_ACTIONS: Record<RecoveryActionKind, RecoveryActionMeta> = {
  "ota.rollback": {
    label: "OTA 롤백",
    description: "현재 배포 중인 펌웨어 캠페인을 즉시 중단하고 직전 stable 로 되돌립니다.",
    last_invoked_at: "2026-04-22T10:00:00Z",
    destructive: true,
  },
  "persona.recall": {
    label: "Persona 회수 (라이브 → 보관)",
    description: "라이브 페르소나를 즉시 archived 상태로 전환. 새 세션은 기본 persona 로 fallback.",
    last_invoked_at: null,
    destructive: true,
  },
  "push.resend": {
    label: "Push 재발송 (실패 토큰)",
    description: "FCM/APNs 실패로 미수신된 토큰만 추려 재발송 큐에 적재.",
    last_invoked_at: "2026-05-19T11:00:00Z",
    destructive: false,
  },
  "device.reset": {
    label: "디바이스 강제 리셋",
    description: "선택된 디바이스에 BLE/WSS 채널로 reset 명령을 전송. 부팅 후 재페어링 필요.",
    last_invoked_at: null,
    destructive: true,
  },
  "user.force_logout_all": {
    label: "사용자 전체 강제 로그아웃",
    description: "특정 사용자의 모든 refresh family 를 revoke. 모든 디바이스에서 즉시 로그아웃.",
    last_invoked_at: "2026-05-18T22:14:00Z",
    destructive: true,
  },
};

// ── 8) kill switch — 전역/지역 기능 차단 토글 ────────────────────
export type KillSwitchKind =
  | "ai.calls"
  | "push.send"
  | "ota.rollout"
  | "billing.webhook"
  | "ble.pairing";

export type KillSwitchState = {
  kind: KillSwitchKind;
  label: string;
  description: string;
  enabled: boolean;
  /** 활성화 시 차단 범위. */
  scope: "global" | "region:KR" | "region:JP" | "region:US";
  /** 마지막 토글 시각/운영자/사유. */
  last_toggled_at: string | null;
  last_toggled_by: string | null;
  last_reason: string | null;
};

export const mockKillSwitches: KillSwitchState[] = [
  {
    kind: "ai.calls",
    label: "AI 호출 차단",
    description: "Gemini · ai-worker 호출 전면 차단. 사용자에겐 in-character 라인으로 완충.",
    enabled: false,
    scope: "global",
    last_toggled_at: null,
    last_toggled_by: null,
    last_reason: null,
  },
  {
    kind: "push.send",
    label: "Push 발송 차단",
    description: "APNs/FCM 발송을 큐에서 중단. 캠페인 신규 적재는 가능하나 dispatch 차단.",
    enabled: false,
    scope: "global",
    last_toggled_at: "2026-05-12T11:55:00Z",
    last_toggled_by: "ops@iconia.example.com",
    last_reason: "APNs 토큰 갱신 작업 중 일시 차단",
  },
  {
    kind: "ota.rollout",
    label: "OTA 배포 일시중단",
    description: "신규 OTA 배포 캠페인 시작 차단. 기존 진행 캠페인은 그대로.",
    enabled: false,
    scope: "global",
    last_toggled_at: null,
    last_toggled_by: null,
    last_reason: null,
  },
  {
    kind: "billing.webhook",
    label: "결제 webhook 수신 차단",
    description: "Woo (커머스) 결제 webhook 수신 차단. 큐 적재가 멈춰 백오피스 작업 시 사용.",
    enabled: false,
    scope: "global",
    last_toggled_at: null,
    last_toggled_by: null,
    last_reason: null,
  },
  {
    kind: "ble.pairing",
    label: "BLE 신규 페어링 차단",
    description: "App 신규 페어링 수락 차단. 기존 페어링 디바이스 통신은 영향 없음.",
    enabled: false,
    scope: "region:KR",
    last_toggled_at: null,
    last_toggled_by: null,
    last_reason: null,
  },
];

// ── 9) feature flag — 캠페인/실험/단계적 배포 토글 ──────────────
export type FeatureFlagRow = {
  key: string;
  label: string;
  description: string;
  /** 활성화 상태. */
  enabled: boolean;
  /** 단계적 배포 비율 (0~100). */
  rollout_pct: number;
  /** 노출 대상 segment. */
  audience: "all" | "premium" | "owners" | "internal";
  updated_at: string;
  updated_by: string | null;
};

export const mockFeatureFlags: FeatureFlagRow[] = [
  {
    key: "social_feed.v2",
    label: "소셜 피드 v2",
    description: "App 신규 피드 표면 (피처플래그 뒤). 점진적 노출.",
    enabled: true,
    rollout_pct: 25,
    audience: "all",
    updated_at: "2026-05-18T03:00:00Z",
    updated_by: "ops@iconia.example.com",
  },
  {
    key: "commerce.checkout_v2",
    label: "커머스 체크아웃 v2",
    description: "Woo PG 흐름을 새 webhook 으로 전환. 결제 신뢰성 SLO 추적.",
    enabled: false,
    rollout_pct: 0,
    audience: "premium",
    updated_at: "2026-05-10T07:00:00Z",
    updated_by: "ops@iconia.example.com",
  },
  {
    key: "persona.taro_beta",
    label: "타로 페르소나 베타",
    description: "신규 페르소나 타로의 노출. 라이브 전환 전 베타 사용자 한정.",
    enabled: true,
    rollout_pct: 5,
    audience: "premium",
    updated_at: "2026-05-17T22:50:00Z",
    updated_by: "ops@iconia.example.com",
  },
  {
    key: "ai.bedrock_fallback",
    label: "AI Bedrock fallback",
    description: "Gemini 타임아웃 시 Bedrock Claude 로 폴백. RAG slice 2 의존.",
    enabled: false,
    rollout_pct: 0,
    audience: "internal",
    updated_at: "2026-05-19T01:00:00Z",
    updated_by: "ops@iconia.example.com",
  },
  {
    key: "ota.canary_widen",
    label: "OTA canary 확대",
    description: "canary 채널 노출을 12 → 200 대로 단계 확대.",
    enabled: true,
    rollout_pct: 100,
    audience: "internal",
    updated_at: "2026-05-18T03:11:00Z",
    updated_by: "ops@iconia.example.com",
  },
];

// ── 6) recovery action 라벨 헬퍼 ─────────────────────────────────
export const RECOVERY_ACTION_KIND_LIST: RecoveryActionKind[] = [
  "ota.rollback",
  "persona.recall",
  "push.resend",
  "device.reset",
  "user.force_logout_all",
];

export const KILL_SWITCH_KIND_LIST: KillSwitchKind[] = [
  "ai.calls",
  "push.send",
  "ota.rollout",
  "billing.webhook",
  "ble.pairing",
];

// ── 표시 헬퍼 ────────────────────────────────────────────────
export function severityChip(sev: OpsAlertRow["severity"]): string {
  if (sev === "critical") return "chip chip-error";
  if (sev === "warn") return "chip chip-warn";
  return "chip chip-info";
}

export function healthStatusChip(status: HealthProbeRow["status"]): string {
  if (status === "down") return "chip chip-error";
  if (status === "degraded") return "chip chip-warn";
  return "chip chip-success";
}

export function hopChip(hop: TraceEvent["hop"]): string {
  switch (hop) {
    case "app":
      return "chip chip-info";
    case "server":
      return "chip chip-success";
    case "ai":
      return "chip chip-warn";
    case "firmware":
      return "chip chip-muted";
  }
}
