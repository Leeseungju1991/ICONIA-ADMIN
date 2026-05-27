import { authedRequest } from "./httpClient";
import type { ServerResult } from "./types";

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type UserRow = {
  id: string;
  email: string;
  display_name?: string | null;
  account_status?: string;
  paused_at?: string | null;
  pending_deletion_at?: string | null;
  totp_enabled?: boolean;
  last_login_at?: string | null;
  created_at?: string;
};

export type UsersList = { users: UserRow[]; total: number };
export type UserDetail = { user: UserRow; active_session_count: number };
export type ForceLogoutResult = { revoked_count: number };

export type DeviceRow = {
  device_id: string;
  user_id: string | null;
  serial: string | null;
  firmware_version: string | null;
  hardware_revision: string | null;
  last_seen_at: string | null;
  last_battery_percent: number | null;
  online: boolean;
  paired_at: string | null;
  status: string; // 'active' | 'lost' | 'unpaired' | 'archived'
};
export type DevicesList = { items: DeviceRow[]; next_cursor: string | null };

export type FirmwareVersionRow = {
  version: string;
  channel: string; // 'stable' | 'beta' | 'dev'
  released_at: string;
  size_bytes: number | null;
  sha256: string | null;
  notes: string | null;
};
export type DeploymentRow = {
  id: string;
  version: string;
  cohort_id: string | null;
  state: string; // 'queued' | 'rolling' | 'paused' | 'completed' | 'aborted'
  rollout_percent: number;
  succeeded: number;
  failed: number;
  started_at: string | null;
  updated_at: string;
};
export type FirmwareList = {
  versions: FirmwareVersionRow[];
  deployments: DeploymentRow[];
};

// AI 호출 운영 관측 — Server `GET /api/v1/admin/ai-health` 응답.
// 정본 shape 는 Server `services/aiHealthTracker.js` 의 `snapshot()` 출력과 1:1 정합.
// 5분 sliding window in-memory 통계 (fallback rate · p50/p95/p99 latency · 모델별 분해).
/**
 * AI 응답 종합 차원 — soul_catalog_id 또는 kind(text/voice/vision) 별로
 * `metricsBuffer` 가 분해한 누계. AI 측이 비어 있어도 빈 객체 `{}` 가 들어온다.
 *
 * 정본: `3. AI/src/observability/metricsBuffer.js` → `_serializeBreakdown()`.
 */
export type AiBreakdownEntry = {
  success: number;
  fallback: number;
  error: number;
  total: number;
  success_rate: number; // 0~1
  fallback_rate: number; // 0~1
  latency_ms_avg: number;
  latency_ms_count: number;
  last_ts: number | null;
};

// AI 호출 운영 관측 — Server `GET /api/v1/admin/ai-health` 응답.
// 정본 shape 는 Server `services/aiHealthTracker.js` 의 `snapshot()` 출력과 1:1 정합.
// 5분 sliding window in-memory 통계 (fallback rate · p50/p95/p99 latency · 모델별 분해).
//
// by_soul_catalog_id / by_kind 는 AI service 의 `/v1/metrics/snapshot` 차원을
// Server 가 그대로 후방위임한다 (서비스 재시작 시 0 으로 리셋되는 in-memory 누계).
export type AiHealthSnapshot = {
  window_ms: number;
  window_total: number;
  fallback_count: number;
  fallback_rate: number; // 0~1
  fallback_breakdown: Record<string, number>;
  error_count: number;
  error_rate: number; // 0~1
  latency_ms: { p50: number; p95: number; p99: number; max: number };
  prompt_tokens_total: number;
  completion_tokens_total: number;
  calls_last_minute: number;
  by_model: Array<{
    model: string;
    calls: number;
    fallback_count: number;
    prompt_tokens: number;
    completion_tokens: number;
    avg_latency_ms: number;
  }>;
  /** SOUL 카탈로그 id 별 분해 — 비어 있을 수도 있음. (AI service 재시작 시 0). */
  by_soul_catalog_id?: Record<string, AiBreakdownEntry>;
  /** 응답 종류 (text / voice / vision) 별 분해. */
  by_kind?: Record<"text" | "voice" | "vision", AiBreakdownEntry>;
  /**
   * Phase 8 #17 — 비용 차원. Server `aiHealthTracker.snapshot()` 가 AI service
   * snapshot 의 by_user_id.cost_usd_sum 합계로 합성하여 forward.
   * 운영 환경 변수 AI_PRICING_KRW_PER_USD (기본 1380) 가 환율 결정.
   */
  cost?: {
    total_usd: number;
    total_krw: number;
    by_kind?: Record<string, { usd: number; krw: number }>;
    by_model?: Record<string, { usd: number; krw: number; calls: number }>;
  };
  /**
   * Phase 16 — Server `/api/v1/admin/ai-health` 확장 필드.
   * AI service 가 `context_compressed: true` 응답을 낼 때마다 +1 (5분 윈도우).
   * Server `aiHealthTracker.snapshot()` 가 누적, opt-in. legacy 응답엔 undefined.
   */
  context_compressed_count_5m?: number;
  /** provider(gemini/deepseek/vertex) 별 호출 분포 (5분 윈도우). */
  provider_distribution_5m?: Record<string, number>;
  /**
   * AI service `/v1/health/full.gemini_key_pool` 의 forward.
   * keys: 활성/cooldown 상태별 카운트. 키 평문은 절대 노출되지 않음.
   */
  key_pool?: {
    total: number;
    active: number;
    cooling_down: number;
    disabled: number;
  } | null;
};

export type PostRow = {
  post_id: string;
  author_user_id: string;
  author_handle: string | null;
  body_excerpt: string;
  reaction_count: number;
  comment_count: number;
  reported_count: number;
  status: string; // server: 'published' | 'hidden' | 'removed'
  created_at: string;
};
export type PostsList = { items: PostRow[]; next_cursor: string | null };

export type OperatorRow = {
  id: string;
  email: string;
  role: string;
  totp_enrolled: boolean;
  last_login_at: string | null;
  disabled_at: string | null;
  created_at: string;
};
export type OperatorsList = { operators: OperatorRow[] };

// 현재 운영자 세션 신원 — Server `GET /api/v1/operator/me` 응답.
// id / email / role 은 Server 가 JWT 를 서명 검증한 뒤 신뢰 가능한 값으로 반환한다.
// Admin 의 unsafe JWT decode (`decodeJwtPayloadUnsafe`) 를 대체하는 정본 소스.
export type OperatorMe = {
  id: string;
  email: string;
  role: string;
};

export type ProductRow = {
  id: string;
  woo_id: number | null;
  sku: string | null;
  slug: string;
  name: string;
  price: string;
  currency: string;
  stock_status: string;
  stock_quantity: number | null;
  primary_image: string | null;
  permalink: string | null;
  doll_related: boolean;
  status: string;
  synced_at: string;
};
export type ProductsList = { items: ProductRow[]; next_cursor: string | null };

// Order shape exposed to admin — EXCLUDES payment_method, transaction_id,
// billing card details. Only fulfillment + status fields are surfaced.
export type AdminOrderRow = {
  id: string;
  woo_id: number | null;
  status: string;
  customer_email: string | null;
  total_amount: string;
  currency: string;
  item_count: number;
  paid_at: string | null;
  completed_at: string | null;
  created_at: string;
};
export type OrdersList = { items: AdminOrderRow[]; next_cursor: string | null };

export type WebhookEventRow = {
  id: string;
  delivery_id: string;
  topic: string;
  resource: string;
  event: string;
  processed: boolean;
  failure_reason: string | null;
  created_at: string;
  processed_at: string | null;
};
export type WebhookEventsList = { items: WebhookEventRow[]; next_cursor: string | null };

export type SyncResult = { synced: number };

// ---------------------------------------------------------------------------
// Low-level authed request — lib/httpClient.ts 의 공유 구현을 사용 (P1 §5.2 #34).
// 이전 인라인 사본은 제거 — 시그니처는 동일.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Users — existing surface preserved.
// ---------------------------------------------------------------------------

export function searchUsers(args: {
  jwt: string;
  email: string;
  limit?: number;
}): Promise<ServerResult<UsersList>> {
  const params = new URLSearchParams();
  params.set("email", args.email);
  if (typeof args.limit === "number") params.set("limit", String(args.limit));
  return authedRequest<UsersList>({
    jwt: args.jwt,
    path: `/api/v1/admin/users?${params.toString()}`,
    method: "GET",
  });
}

export function getUserDetail(args: {
  jwt: string;
  userId: string;
}): Promise<ServerResult<UserDetail>> {
  return authedRequest<UserDetail>({
    jwt: args.jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}`,
    method: "GET",
  });
}

export function forceLogoutUser(args: {
  jwt: string;
  userId: string;
  reason?: string;
}): Promise<ServerResult<ForceLogoutResult>> {
  // reason 은 ConfirmActionForm 가 강제 (5자 이상) — server 가 body 의 reason 을 audit
  // 로그에 기록하면 forensic 가치 회복. server 미지원 시 body 가 무시될 뿐 정상 동작.
  return authedRequest<ForceLogoutResult>({
    jwt: args.jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/force-logout`,
    method: "POST",
    body: args.reason ? { reason: args.reason } : {},
  });
}

// ---------------------------------------------------------------------------
// Devices
// ---------------------------------------------------------------------------

export function listDevices(args: {
  jwt: string;
  query?: string;
  status?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<ServerResult<DevicesList>> {
  const params = new URLSearchParams();
  if (args.query) params.set("q", args.query);
  if (args.status) params.set("status", args.status);
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest<DevicesList>({
    jwt: args.jwt,
    path: `/api/v1/admin/devices${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export function getDeviceDetail(args: {
  jwt: string;
  deviceId: string;
}): Promise<ServerResult<{ device: DeviceRow; ota_history: Array<{ version: string; result: string; at: string }> }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/devices/${encodeURIComponent(args.deviceId)}`,
    method: "GET",
  });
}

export function forceUnpairDevice(args: {
  jwt: string;
  deviceId: string;
  reason: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/devices/${encodeURIComponent(args.deviceId)}/force-unpair`,
    method: "POST",
    body: { reason: args.reason },
  });
}

export function markDeviceLost(args: {
  jwt: string;
  deviceId: string;
  note?: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/devices/${encodeURIComponent(args.deviceId)}/mark-lost`,
    method: "POST",
    body: { note: args.note ?? "" },
  });
}

// ---------------------------------------------------------------------------
// Firmware
// ---------------------------------------------------------------------------

export function listFirmware(args: {
  jwt: string;
}): Promise<ServerResult<FirmwareList>> {
  return authedRequest<FirmwareList>({
    jwt: args.jwt,
    path: `/api/v1/admin/firmware`,
    method: "GET",
  });
}

// pause/resume — Server 의 actual endpoint 는 단수형 `/api/admin/firmware/deployment/:id/...`
// (firmwareDeploymentRoutes.js:136~). pause 는 abort 와 다른 별도 endpoint (state="holding"
// + hold_at / hold_reason / resumed_at 컬럼으로 추적) — 본 라운드에서 abort 우회 버그 정정.
//
// 일시정지: state="holding" 으로 전환, OTA serving 즉시 중단. resume 으로 동일 deployment 재개.
// abort 는 별도 destroyer 함수로 후속 라운드에 분리 노출 예정.
export function pauseDeployment(args: {
  jwt: string;
  deploymentId: string;
  reason?: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/admin/firmware/deployment/${encodeURIComponent(args.deploymentId)}/pause`,
    method: "POST",
    body: { reason: args.reason ?? "" },
  });
}

export function resumeDeployment(args: {
  jwt: string;
  deploymentId: string;
  reason?: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/admin/firmware/deployment/${encodeURIComponent(args.deploymentId)}/resume`,
    method: "POST",
    body: args.reason ? { reason: args.reason } : {},
  });
}

// ---------------------------------------------------------------------------
// AI health
// ---------------------------------------------------------------------------

export function getAiHealth(args: {
  jwt: string;
}): Promise<ServerResult<AiHealthSnapshot>> {
  return authedRequest<AiHealthSnapshot>({
    jwt: args.jwt,
    path: `/api/v1/admin/ai-health`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// Posts moderation
// ---------------------------------------------------------------------------

export function listPosts(args: {
  jwt: string;
  filter?: "all" | "reported" | "hidden";
  cursor?: string | null;
  limit?: number;
}): Promise<ServerResult<PostsList>> {
  const params = new URLSearchParams();
  if (args.filter) params.set("filter", args.filter);
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest<PostsList>({
    jwt: args.jwt,
    path: `/api/v1/admin/posts${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export function hidePost(args: {
  jwt: string;
  postId: string;
  reason: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/posts/${encodeURIComponent(args.postId)}/hide`,
    method: "POST",
    body: { reason: args.reason },
  });
}

export function unhidePost(args: {
  jwt: string;
  postId: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/posts/${encodeURIComponent(args.postId)}/unhide`,
    method: "POST",
    body: {},
  });
}

// ---------------------------------------------------------------------------
// Operator identity
// ---------------------------------------------------------------------------

/**
 * 현재 운영자 세션 신원 조회 — Server `GET /api/v1/operator/me` (모든 role 허용).
 * Server 가 JWT 서명을 검증한 뒤 id/email/role 을 반환하므로, Admin 의
 * client-decodable unsafe JWT decode 보다 신뢰 가능한 정본 소스다.
 */
export function getOperatorMe(args: {
  jwt: string;
}): Promise<ServerResult<OperatorMe>> {
  return authedRequest<OperatorMe>({
    jwt: args.jwt,
    path: `/api/v1/operator/me`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// Operators
// ---------------------------------------------------------------------------

export function listOperators(args: {
  jwt: string;
}): Promise<ServerResult<OperatorsList>> {
  return authedRequest<OperatorsList>({
    jwt: args.jwt,
    path: `/api/v1/operator/admin/operators`,
    method: "GET",
  });
}

export function disableOperator(args: {
  jwt: string;
  operatorId: string;
  reason: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/operator/admin/operators/${encodeURIComponent(args.operatorId)}/disable`,
    method: "POST",
    body: { reason: args.reason },
  });
}

// ---------------------------------------------------------------------------
// Commerce — EXCLUDES payment fields per round scope.
// ---------------------------------------------------------------------------

export function listProducts(args: {
  jwt: string;
  cursor?: string | null;
  limit?: number;
}): Promise<ServerResult<ProductsList>> {
  const params = new URLSearchParams();
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest<ProductsList>({
    jwt: args.jwt,
    path: `/api/v1/commerce/products${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export function syncProducts(args: { jwt: string }): Promise<ServerResult<SyncResult>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/commerce/sync/products`,
    method: "POST",
    body: {},
  });
}

export function syncCategories(args: { jwt: string }): Promise<ServerResult<SyncResult>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/commerce/sync/categories`,
    method: "POST",
    body: {},
  });
}

export function syncOrders(args: { jwt: string }): Promise<ServerResult<SyncResult>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/commerce/sync/orders`,
    method: "POST",
    body: {},
  });
}

// Order list — server should project away payment_method/transaction_id when
// caller is admin web. Admin UI never displays those columns.
export function listOrders(args: {
  jwt: string;
  cursor?: string | null;
  status?: string;
  limit?: number;
}): Promise<ServerResult<OrdersList>> {
  const params = new URLSearchParams();
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.status) params.set("status", args.status);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest<OrdersList>({
    jwt: args.jwt,
    path: `/api/v1/admin/commerce/orders${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export function listWebhookEvents(args: {
  jwt: string;
  cursor?: string | null;
  limit?: number;
  onlyFailures?: boolean;
}): Promise<ServerResult<WebhookEventsList>> {
  const params = new URLSearchParams();
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  if (args.onlyFailures) params.set("only_failures", "1");
  const qs = params.toString();
  return authedRequest<WebhookEventsList>({
    jwt: args.jwt,
    path: `/api/v1/admin/commerce/webhooks${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// V1.0 #1 — Admin user actions (pause / resume / mfa-reset)
//   Server: POST /api/v1/admin/users/:id/{pause,resume,mfa-reset}
//   audit_log 자동 기록. pending_deletion 사용자에 대한 resume 은 409.
// ---------------------------------------------------------------------------

export function pauseUser(args: {
  jwt: string;
  userId: string;
  reason?: string;
}): Promise<ServerResult<{ user: UserRow; already_paused: boolean }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/pause`,
    method: "POST",
    body: args.reason ? { reason: args.reason } : {},
  });
}

export function resumeUser(args: {
  jwt: string;
  userId: string;
  reason?: string;
}): Promise<ServerResult<{ user: UserRow; already_active: boolean }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/resume`,
    method: "POST",
    body: args.reason ? { reason: args.reason } : {},
  });
}

export function mfaResetUser(args: {
  jwt: string;
  userId: string;
  reason?: string;
}): Promise<ServerResult<{ reset: boolean; was_enrolled: boolean }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/mfa-reset`,
    method: "POST",
    body: args.reason ? { reason: args.reason } : {},
  });
}

// ---------------------------------------------------------------------------
// V1.0 #3 — AI 페르소나 admin 표면
//   Server: GET /api/v1/admin/personas
//   PersonaClient.listCatalog 결과 + aiHealthTracker 의 SOUL 별 분해 (있을 때) 결합.
// ---------------------------------------------------------------------------

export type AdminPersonaRow = {
  soul_catalog_id: string;
  name: string;
  status: string;
  fallback_rate: number | null;
  last_response_ts: string | null;
};

export function listPersonas(args: {
  jwt: string;
}): Promise<
  ServerResult<{
    personas: AdminPersonaRow[];
    catalog_error: { code: string; message: string } | null;
  }>
> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/personas`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// V1.0 #5 / V3.0 #17 — 펌웨어 실패 기기 목록
//   Server: GET /api/v1/admin/firmware/failures?version=&since=
// ---------------------------------------------------------------------------

export type FirmwareFailureDevice = {
  device_id_hash: string | null;
  deployment_id: string | null;
  error_code: string;
  phase: "failed" | "rolled_back";
  cohort: string | null;
  at: string;
};

export type FirmwareFailureList = {
  total: number;
  since: string;
  version: string | null;
  by_reason: Array<{ error_code: string; count: number }>;
  devices: FirmwareFailureDevice[];
};

export function listFirmwareFailures(args: {
  jwt: string;
  version?: string;
  since?: string;
}): Promise<ServerResult<FirmwareFailureList>> {
  const params = new URLSearchParams();
  if (args.version) params.set("version", args.version);
  if (args.since) params.set("since", args.since);
  const qs = params.toString();
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/firmware/failures${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// V1.0 #7 — CS 통합 조회
//   Server: GET /api/v1/admin/cs/lookup?q=
// ---------------------------------------------------------------------------

export type CsLookupResult = {
  query: string;
  query_kind: "email" | "uuid" | "device_id" | "unknown";
  user: UserRow | null;
  devices: Array<{
    id: string;
    device_id: string;
    firmware_version: string | null;
    owner_user_id: string | null;
    status: string;
    paired_at: string | null;
  }>;
  recent_audits: Array<{
    id: string;
    action: string;
    created_at: string;
    operator_role: string | null;
  }>;
  recent_errors: unknown[];
  active_session: {
    family_id: string;
    ip: string | null;
    last_seen: string;
    location_hint: string | null;
  } | null;
  pipa_state: {
    account_status: string;
    paused_at: string | null;
    pending_deletion_at: string | null;
    scheduled_purge_at: string | null;
    consent_terms_version: string | null;
    consent_privacy_version: string | null;
    consent_accepted_at: string | null;
    marketing_opt_in: boolean;
  } | null;
  note?: string;
};

export function csLookup(args: {
  jwt: string;
  q: string;
}): Promise<ServerResult<CsLookupResult>> {
  const params = new URLSearchParams({ q: args.q });
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/cs/lookup?${params.toString()}`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// V2.0 #10 — Dead-letter queue (목록 / 재처리)
//   Server: GET /api/v1/admin/dead-letter?status=&cursor=&limit=
//           POST /api/v1/admin/dead-letter/:id/retry
// ---------------------------------------------------------------------------

export type DeadLetterRow = {
  id: string;
  event_id: string;
  status: "pending" | "exhausted";
  attempts: number;
  next_attempt_after: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string;
};

export function listDeadLetter(args: {
  jwt: string;
  status?: "pending" | "exhausted";
  cursor?: string | null;
  limit?: number;
}): Promise<ServerResult<{ items: DeadLetterRow[]; next_cursor: string | null }>> {
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/dead-letter${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export function retryDeadLetter(args: {
  jwt: string;
  id: string;
}): Promise<
  ServerResult<{
    id: string;
    event_id: string;
    exhausted: boolean;
    next_attempt_after: string;
  }>
> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/dead-letter/${encodeURIComponent(args.id)}/retry`,
    method: "POST",
    body: {},
  });
}

/**
 * Phase 9 #2 — DLQ bulk-retry (최대 50개).
 * Server: POST /api/v1/admin/dead-letter/bulk-retry  (SRE/superadmin)
 */
export type BulkRetryResult = {
  requested: number;
  succeeded: number;
  failed: number;
  results: Array<{
    id: string;
    ok: boolean;
    event_id?: string;
    upload_kind?: string;
    error_code?: string;
    error_message?: string;
  }>;
};

export function bulkRetryDeadLetter(args: {
  jwt: string;
  ids: string[];
}): Promise<ServerResult<BulkRetryResult>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/dead-letter/bulk-retry`,
    method: "POST",
    body: { ids: args.ids.slice(0, 50) },
  });
}

/**
 * Phase 9 #5 — Operator TOTP backup codes.
 * Server: POST /api/v1/operator/totp/backup-codes/generate (10개, 평문은 응답 1회만)
 *          POST /api/v1/operator/totp/backup-codes/verify (분실 시 1회용 코드)
 */
export function generateBackupCodes(args: {
  jwt: string;
}): Promise<ServerResult<{ codes: string[]; count: number }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/operator/totp/backup-codes/generate`,
    method: "POST",
    body: {},
  });
}

export function verifyBackupCode(args: {
  jwt: string;
  code: string;
}): Promise<ServerResult<{ ok: true; code_id: string; remaining: number }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/operator/totp/backup-codes/verify`,
    method: "POST",
    body: { code: args.code },
  });
}

// ---------------------------------------------------------------------------
// V3.0 #14 — 제조 LOT / 시리얼 / 출고 테스트
//   Server: POST /api/v1/admin/lots
//           POST /api/v1/admin/lots/:lot_id/serials/batch
//           POST /api/v1/admin/factory-test
// ---------------------------------------------------------------------------

export type ProductionLotRow = {
  id: string;
  lot_code: string;
  planned_qty: number;
  status: "planned" | "in_production" | "completed" | "shipped";
};

export function createProductionLot(args: {
  jwt: string;
  lot_code: string;
  planned_qty?: number;
  notes?: string;
}): Promise<ServerResult<{ lot: ProductionLotRow }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/lots`,
    method: "POST",
    body: {
      lot_code: args.lot_code,
      ...(typeof args.planned_qty === "number" ? { planned_qty: args.planned_qty } : {}),
      ...(args.notes ? { notes: args.notes } : {}),
    },
  });
}

export function batchIssueSerials(args: {
  jwt: string;
  lotId: string;
  count: number;
  serial_prefix?: string;
}): Promise<
  ServerResult<{
    lot_id: string;
    count: number;
    serials: Array<{ serial: string; qr_token: string }>;
  }>
> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/lots/${encodeURIComponent(args.lotId)}/serials/batch`,
    method: "POST",
    body: {
      count: args.count,
      ...(args.serial_prefix ? { serial_prefix: args.serial_prefix } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// V2.0 #8 — 전체 운영 대시보드 overview
//   Server: GET /api/v1/admin/overview
// ---------------------------------------------------------------------------

export type DomainHealth = {
  status: "ok" | "degraded" | "down" | "not_applicable";
  detail: string;
  observed_at: string;
};

export type AdminOverview = {
  active_devices: number;
  dau: number;
  errors_24h: { server: number; app: number; firmware: number };
  fallback_rate: number;
  queue_depth: number;
  server_health: "ok" | "degraded" | "down";
  firmware_critical_count: number;
  reports_pending: number;
  /** Phase4-A — 6도메인 health probe. AWS는 DEPLOY_TARGET=local 일 때 not_applicable. */
  domains?: {
    hw: DomainHealth;
    server: DomainHealth;
    ai: DomainHealth;
    app: DomainHealth;
    admin: DomainHealth;
    aws: DomainHealth;
  };
};

export function fetchAdminOverview(args: {
  jwt: string;
}): Promise<ServerResult<AdminOverview>> {
  return authedRequest<AdminOverview>({
    jwt: args.jwt,
    path: `/api/v1/admin/overview`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// V2.0 #9 — 이벤트 타임라인 trace
//   Server: GET /api/v1/admin/trace/:traceId
// ---------------------------------------------------------------------------

export type TraceHop = {
  at: string;
  hop_kind: "event" | "audit" | "firmware";
  source: string;
  payload: Record<string, unknown>;
};

export function fetchAdminTrace(args: {
  jwt: string;
  traceId: string;
}): Promise<ServerResult<{ trace_id: string; hops: TraceHop[] }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/trace/${encodeURIComponent(args.traceId)}`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// V2.0 #12 — IncidentAlert
//   Server: GET /api/v1/admin/alerts?since=&status=
//           POST /api/v1/admin/alerts/:id/ack body=note
// ---------------------------------------------------------------------------

export type IncidentAlertRow = {
  id: string;
  kind:
    | "ai_fallback_threshold"
    | "firmware_rollback_spike"
    | "db_unreachable"
    | "deploy_failed";
  severity: "info" | "warning" | "critical";
  message: string;
  source: string;
  opened_at: string;
  closed_at: string | null;
  acknowledged_by: string | null;
  payload: Record<string, unknown>;
};

export function listIncidentAlerts(args: {
  jwt: string;
  since?: string;
  status?: "open" | "closed";
  limit?: number;
}): Promise<ServerResult<{ items: IncidentAlertRow[] }>> {
  const params = new URLSearchParams();
  if (args.since) params.set("since", args.since);
  if (args.status) params.set("status", args.status);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/alerts${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export function ackIncidentAlert(args: {
  jwt: string;
  id: string;
  note: string;
}): Promise<ServerResult<IncidentAlertRow>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/alerts/${encodeURIComponent(args.id)}/ack`,
    method: "POST",
    body: { note: args.note },
  });
}

// ---------------------------------------------------------------------------
// V3.0 #16 — 기기 소유권 이력
//   Server: GET /api/v1/admin/devices/:id/ownership-history
// ---------------------------------------------------------------------------

export type OwnershipHop = {
  at: string;
  kind: "claim_attempt" | "paired" | "revoked" | "lost";
  user_id: string | null;
  reason: string | null;
  operator_id: string | null;
};

export function fetchDeviceOwnershipHistory(args: {
  jwt: string;
  deviceId: string;
}): Promise<
  ServerResult<{ device_id: string; device_uuid: string | null; history: OwnershipHop[] }>
> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/devices/${encodeURIComponent(args.deviceId)}/ownership-history`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// V3.0 #18 — PIPA admin
//   Server: GET /api/v1/admin/users/pipa?status=
//           POST /api/v1/admin/users/:id/pipa/export
//           POST /api/v1/admin/users/:id/pipa/finalize
// ---------------------------------------------------------------------------

export type PipaUserRow = {
  user_id: string;
  account_status: string;
  pending_deletion_at: string | null;
  scheduled_purge_at: string | null;
  recent_export_at: string | null;
};

export function listPipaUsers(args: {
  jwt: string;
  status: "pending_deletion" | "recent_export";
}): Promise<ServerResult<{ items: PipaUserRow[] }>> {
  const params = new URLSearchParams({ status: args.status });
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/users/pipa?${params.toString()}`,
    method: "GET",
  });
}

export function triggerPipaExport(args: {
  jwt: string;
  userId: string;
  reason: string;
}): Promise<ServerResult<{ id: string; status: string }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/pipa/export`,
    method: "POST",
    body: { reason: args.reason },
  });
}

export function finalizePipaDeletion(args: {
  jwt: string;
  userId: string;
  reason: string;
}): Promise<ServerResult<{ ok: boolean; deleted_at?: string }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/pipa/finalize`,
    method: "POST",
    body: { reason: args.reason },
  });
}

// ---------------------------------------------------------------------------
// V3.0 #20 — AS Ticket
//   Server: POST /api/v1/admin/as/tickets
//           POST /api/v1/admin/as/tickets/:id/replace
//           POST /api/v1/admin/as/tickets/:id/close
//           GET  /api/v1/admin/as/tickets?status=&cursor=&limit=
// ---------------------------------------------------------------------------

export type AsTicketStatus = "received" | "in_repair" | "replaced" | "closed";

export type AsTicketRow = {
  id: string;
  status: AsTicketStatus;
  reason: string;
  user_id: string;
  device_id: string;
  replacement_device_id: string | null;
  opened_at: string;
  closed_at: string | null;
  operator_id_opened: string | null;
  operator_id_closed: string | null;
  notes: string | null;
};

export function createAsTicket(args: {
  jwt: string;
  user_id: string;
  device_id: string;
  reason: string;
}): Promise<ServerResult<{ ticket: AsTicketRow; unpaired: number }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/as/tickets`,
    method: "POST",
    body: { user_id: args.user_id, device_id: args.device_id, reason: args.reason },
  });
}

export function replaceAsTicket(args: {
  jwt: string;
  id: string;
  replacement_device_id: string;
}): Promise<ServerResult<AsTicketRow>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/as/tickets/${encodeURIComponent(args.id)}/replace`,
    method: "POST",
    body: { replacement_device_id: args.replacement_device_id },
  });
}

export function closeAsTicket(args: {
  jwt: string;
  id: string;
  note: string;
}): Promise<ServerResult<AsTicketRow>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/as/tickets/${encodeURIComponent(args.id)}/close`,
    method: "POST",
    body: { note: args.note },
  });
}

export function listAsTickets(args: {
  jwt: string;
  status?: AsTicketStatus;
  cursor?: string | null;
  limit?: number;
}): Promise<ServerResult<{ items: AsTicketRow[]; next_cursor: string | null }>> {
  const params = new URLSearchParams();
  if (args.status) params.set("status", args.status);
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/as/tickets${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// 양산직전 #21 — Ops Report
//   Server: GET /api/v1/admin/reports?kind=&since=&limit=
//           POST /api/v1/admin/reports/run body={kind}
// ---------------------------------------------------------------------------

export type OpsReportKind = "daily" | "weekly" | "quality";

export type OpsReportRow = {
  id: string;
  kind: OpsReportKind;
  period_start: string;
  period_end: string;
  payload: Record<string, unknown>;
  generated_at: string;
};

export function listOpsReports(args: {
  jwt: string;
  kind?: OpsReportKind;
  since?: string;
  limit?: number;
}): Promise<ServerResult<{ items: OpsReportRow[] }>> {
  const params = new URLSearchParams();
  if (args.kind) params.set("kind", args.kind);
  if (args.since) params.set("since", args.since);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/reports${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export function runOpsReport(args: {
  jwt: string;
  kind: OpsReportKind;
}): Promise<ServerResult<{ ok: boolean; id?: string; duplicate?: boolean }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/reports/run`,
    method: "POST",
    body: { kind: args.kind },
  });
}

// ---------------------------------------------------------------------------
// V1.0 #12 / V2.0 #24 — Deployment ledger (Phase4-A)
//   Server: GET /api/v1/admin/deployments?cursor=&limit=&since=
// ---------------------------------------------------------------------------

export type DeploymentLedgerRow = {
  id: string;
  version: string;
  state: string;
  started_at: string | null;
  completed_at: string | null;
  hold_reason?: string | null;
  abort_reason?: string | null;
  rollback_window_until?: string | null;
};

export function listDeployments(args: {
  jwt: string;
  cursor?: string | null;
  limit?: number;
  since?: string;
}): Promise<
  ServerResult<{ items: DeploymentLedgerRow[]; next_cursor: string | null }>
> {
  const params = new URLSearchParams();
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  if (args.since) params.set("since", args.since);
  const qs = params.toString();
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/deployments${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// V3.0 #27 — Device boot invariants (Phase4-A)
//   Server: GET /api/v1/admin/devices/:id/boot-invariants
//   (Secure Boot / Flash Encryption / JTAG Disabled invariant mask 검사)
// ---------------------------------------------------------------------------

export type DeviceBootInvariants = {
  device_id: string;
  boot_invariant_mask: number | null;
  required_mask: number;
  ok: boolean;
  missing_bits: string[];
  last_boot_at: string | null;
  boot_count: number | null;
  fw_version: string | null;
};

export function getDeviceBootInvariants(args: {
  jwt: string;
  deviceId: string;
}): Promise<ServerResult<DeviceBootInvariants>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/devices/${encodeURIComponent(args.deviceId)}/boot-invariants`,
    method: "GET",
  });
}

/**
 * Phase 12 #8 — Fleet 전체 boot_invariant 위반 디바이스 목록.
 * Server: GET /api/v1/admin/devices/boot-invariant-violations (SECOPS_OR_ABOVE)
 */
export type BootInvariantViolation = {
  device_id: string;
  fw_version: string | null;
  mask: number;
  missing_bits: string[];
  last_boot_at: string | null;
};

export function listBootInvariantViolations(args: {
  jwt: string;
  cursor?: string | null;
  limit?: number;
}): Promise<
  ServerResult<{
    items: BootInvariantViolation[];
    next_cursor: string | null;
    total: number;
    required_mask: number;
  }>
> {
  const params = new URLSearchParams();
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/devices/boot-invariant-violations${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

/**
 * Phase 12 #10 — Operator TOTP enroll/verify.
 * Server: POST /api/v1/operator/totp/{enroll,verify}
 */
export function enrollOperatorTotp(args: {
  jwt: string;
}): Promise<ServerResult<{ otpauth_uri: string; totp_secret_base32: string }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/operator/totp/enroll`,
    method: "POST",
    body: {},
  });
}

export function verifyOperatorTotpEnroll(args: {
  jwt: string;
  code: string;
}): Promise<ServerResult<{ ok: true; mfa_required: boolean }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/operator/totp/verify`,
    method: "POST",
    body: { code: args.code },
  });
}

/**
 * Phase 12 #12 / Phase 15 — Server stub endpoint 4종.
 * 현재는 빈 list 반환 (source: "stub"). Phase 15-A 가 notices/push 실 데이터 wire 시 자동 채워짐.
 */
export type StubListItem = Record<string, unknown>;
export type StubListResponse = {
  items: StubListItem[];
  total: number;
  source: string;
};

export function listNotices(args: { jwt: string }): Promise<ServerResult<StubListResponse>> {
  return authedRequest({ jwt: args.jwt, path: `/api/v1/admin/notices`, method: "GET" });
}
export function listPushCampaigns(args: { jwt: string }): Promise<ServerResult<StubListResponse>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/push/campaigns`,
    method: "GET",
  });
}
export function listServerErrors(args: { jwt: string }): Promise<ServerResult<StubListResponse>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/errors/server`,
    method: "GET",
  });
}
export function listAppErrors(args: { jwt: string }): Promise<ServerResult<StubListResponse>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/errors/app`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// Phase 15-A — Persona actions (SUPERADMIN_ONLY).
// ---------------------------------------------------------------------------

export function stagePersona(args: {
  jwt: string;
  soulCatalogId: string;
  reason: string;
}): Promise<ServerResult<{ accepted: boolean; upstream?: unknown }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/personas/${encodeURIComponent(args.soulCatalogId)}/stage`,
    method: "POST",
    body: { reason: args.reason },
  });
}

export function promotePersona(args: {
  jwt: string;
  soulCatalogId: string;
  reason: string;
}): Promise<ServerResult<{ accepted: boolean; upstream?: unknown }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/personas/${encodeURIComponent(args.soulCatalogId)}/promote`,
    method: "POST",
    body: { reason: args.reason },
  });
}

export function rollbackPersona(args: {
  jwt: string;
  soulCatalogId: string;
  reason: string;
  target_version?: string;
}): Promise<ServerResult<{ accepted: boolean; upstream?: unknown }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/personas/${encodeURIComponent(args.soulCatalogId)}/rollback`,
    method: "POST",
    body: {
      reason: args.reason,
      ...(args.target_version ? { target_version: args.target_version } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Phase 15-A — Firmware actions (SRE_OR_ABOVE).
// ---------------------------------------------------------------------------

export function uploadFirmware(args: {
  jwt: string;
  version: string;
  channel: string;
  sha256: string;
  size_bytes: number;
  notes?: string;
}): Promise<ServerResult<{ upload_url: string; s3_key: string }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/firmware/upload`,
    method: "POST",
    body: {
      version: args.version,
      channel: args.channel,
      sha256: args.sha256,
      size_bytes: args.size_bytes,
      ...(args.notes ? { notes: args.notes } : {}),
      presigned_required: true,
    },
  });
}

export function advanceDeployment(args: {
  jwt: string;
  deploymentId: string;
  reason?: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/firmware/deployments/${encodeURIComponent(args.deploymentId)}/advance`,
    method: "POST",
    body: args.reason ? { reason: args.reason } : {},
  });
}

export function abortDeployment(args: {
  jwt: string;
  deploymentId: string;
  reason: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/firmware/deployments/${encodeURIComponent(args.deploymentId)}/abort`,
    method: "POST",
    body: { reason: args.reason },
  });
}

// ---------------------------------------------------------------------------
// Phase 15-A — Reports review/comment/user 분기 + resolve.
// ---------------------------------------------------------------------------

export type FeedReportRow = {
  id: string;
  target_kind: "post" | "review" | "comment" | "user";
  target_id: string;
  reporter_id: string;
  reason: string;
  status: string;
  reported_at: string;
};

export function listFeedReports(args: {
  jwt: string;
  kind: "review" | "comment" | "user";
  cursor?: string;
  limit?: number;
}): Promise<ServerResult<{ items: FeedReportRow[]; next_cursor: string | null }>> {
  const params = new URLSearchParams({ kind: args.kind, filter: "reported" });
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/reports?${params.toString()}`,
    method: "GET",
  });
}

export function resolveFeedReport(args: {
  jwt: string;
  reportId: string;
  action: "hide" | "reject" | "warn";
  reason: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/reports/${encodeURIComponent(args.reportId)}/resolve`,
    method: "POST",
    body: { action: args.action, reason: args.reason },
  });
}

// ---------------------------------------------------------------------------
// Phase 15-A — Notices CRUD (CS_OR_ABOVE).
// ---------------------------------------------------------------------------

export type NoticeRow = {
  id: string;
  title: string;
  body: string;
  audience: string;
  scheduled_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export function createNotice(args: {
  jwt: string;
  title: string;
  body: string;
  audience?: string;
  scheduled_at?: string;
  expires_at?: string;
}): Promise<ServerResult<NoticeRow>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/notices`,
    method: "POST",
    body: {
      title: args.title,
      body: args.body,
      ...(args.audience ? { audience: args.audience } : {}),
      ...(args.scheduled_at ? { scheduled_at: args.scheduled_at } : {}),
      ...(args.expires_at ? { expires_at: args.expires_at } : {}),
    },
  });
}

export function updateNotice(args: {
  jwt: string;
  id: string;
  patch: Partial<Omit<NoticeRow, "id" | "created_at">>;
}): Promise<ServerResult<NoticeRow>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/notices/${encodeURIComponent(args.id)}`,
    method: "PATCH",
    body: args.patch,
  });
}

export function deleteNotice(args: {
  jwt: string;
  id: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/notices/${encodeURIComponent(args.id)}`,
    method: "DELETE",
    body: {},
  });
}

// ---------------------------------------------------------------------------
// Phase 15-A — Push campaigns (CS_OR_ABOVE).
// ---------------------------------------------------------------------------

export type PushCampaignRow = {
  id: string;
  title: string;
  body: string;
  audience: string;
  status: string;
  delivered_count?: number;
  opened_count?: number;
  sent_at?: string | null;
};

export function createPushCampaign(args: {
  jwt: string;
  title: string;
  body: string;
  audience?: string;
}): Promise<ServerResult<PushCampaignRow>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/push/campaigns`,
    method: "POST",
    body: {
      title: args.title,
      body: args.body,
      ...(args.audience ? { audience: args.audience } : {}),
    },
  });
}

export function sendPushCampaign(args: {
  jwt: string;
  id: string;
}): Promise<ServerResult<PushCampaignRow>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/push/campaigns/${encodeURIComponent(args.id)}/send`,
    method: "POST",
    body: {},
  });
}

// ---------------------------------------------------------------------------
// 양산직전 #15 — Fleet 디바이스 분포 (Phase5-A)
//   Server: GET /api/v1/admin/devices/distribution?by=version|region|cohort|fw_state
// ---------------------------------------------------------------------------

export type DistributionBy = "version" | "region" | "cohort" | "fw_state";

export type DistributionItem = {
  key: string;
  count: number;
  percent: number;
};

export function listDeviceDistribution(args: {
  jwt: string;
  by: DistributionBy;
}): Promise<ServerResult<{ by: DistributionBy; items: DistributionItem[] }>> {
  const params = new URLSearchParams({ by: args.by });
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/devices/distribution?${params.toString()}`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// 기존 V3.0 #14 production 영역 client (계속)
// ---------------------------------------------------------------------------

export type FactoryTestSubmission = {
  camera_ok?: boolean;
  mic_ok?: boolean;
  speaker_ok?: boolean;
  battery_ok?: boolean;
  wifi_ok?: boolean;
  https_rtt_ms?: number;
};

/**
 * 공장 fixture 가 production_test 결과를 업로드. 두 인증 경로:
 *   - 운영자 JWT (Admin 콘솔에서 수동 입력) — `jwt` 전달
 *   - factory token (양산 라인 fixture) — `factoryToken` 전달 → Basic auth
 */
export function submitFactoryTest(args: {
  jwt?: string;
  factoryToken?: string;
  serial: string;
  results: FactoryTestSubmission;
  tester_id?: string;
  raw_payload?: Record<string, unknown>;
}): Promise<
  ServerResult<{ serial: string; passed: boolean; test_result_id: string }>
> {
  if (args.factoryToken) {
    // factory client path — Basic auth via shared httpClient 의 별도 헤더 변형은
    // 본 라운드 범위 밖. 일시적으로 authedRequest 의 jwt 자리에 factoryToken 을
    // Bearer 로 전달 (Server adminProductionRoutes 가 FACTORY_TOKEN basic+bearer
    // 둘다 수용하도록 구현됨). 정식 BasicAuth 헬퍼는 후속 라운드.
    return authedRequest({
      jwt: args.factoryToken,
      path: `/api/v1/admin/factory-test`,
      method: "POST",
      body: {
        serial: args.serial,
        results: args.results,
        ...(args.tester_id ? { tester_id: args.tester_id } : {}),
        ...(args.raw_payload ? { raw_payload: args.raw_payload } : {}),
      },
    });
  }
  if (!args.jwt) {
    const err: ServerResult<{ serial: string; passed: boolean; test_result_id: string }> = {
      ok: false,
      status: 401,
      code: "ERR_AUTH_REQUIRED",
      message: "운영자 JWT 또는 factory token 이 필요합니다.",
    };
    return Promise.resolve(err);
  }
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/factory-test`,
    method: "POST",
    body: {
      serial: args.serial,
      results: args.results,
      ...(args.tester_id ? { tester_id: args.tester_id } : {}),
      ...(args.raw_payload ? { raw_payload: args.raw_payload } : {}),
    },
  });
}

// ---------------------------------------------------------------------------
// Legal — 약관/공지/사용자 권리 관리 표면 ((주)숨코리아 출시).
//
// Server 정본 endpoint (도입 예정):
//   GET  /api/v1/legal/business-info                       — 사업자 정보 공개 표시
//   GET  /api/v1/users/consent/active                      — 활성 약관 버전 (사용자도 호출)
//   GET  /api/v1/admin/legal/terms                          — 약관 4종 버전 목록 (모든 버전)
//   POST /api/v1/admin/legal/terms                          — 신버전 발행 (superadmin)
//   GET  /api/v1/admin/legal/consent-stats?days=30          — 약관 버전별 동의율 시계열
//   GET  /api/v1/admin/users/rights?kind=&status=&limit=    — 사용자 권리 요청 큐 (PIPA 확장)
//   POST /api/v1/admin/users/rights/:id/transition          — 권리 요청 상태 전이
//
// 현재 Server 상태:
//   - /api/v1/users/consent/active : 구현됨 (consentService.publicActiveVersionsView)
//   - 그 외 admin/legal/* : 미구현. authedRequest 가 ERR_NETWORK/INVALID_RESPONSE 또는
//     ERR_NOT_FOUND 로 graceful 매핑하므로, 호출자는 fallback path 로 mock 데이터를
//     렌더한다. Server 라우트 추가 즉시 swap 완료.
// ---------------------------------------------------------------------------

/** 약관 종류 4종 — terms(서비스) / privacy(개인정보) / marketing(마케팅) / third_party(제3자 제공). */
export type TermsKind = "terms" | "privacy" | "marketing" | "third_party";

export type TermsVersionRow = {
  kind: TermsKind;
  version: string;
  /** 본문 (markdown 또는 plain text). 다국어 분리는 후속. */
  body_ko: string;
  body_en: string | null;
  /** 본문 hash (sha256 hex). 사용자 동의 시 무결성 확인용. */
  body_hash: string | null;
  /** 활성 버전이면 true. 신규 가입자가 동의해야 하는 버전. */
  is_active: boolean;
  /** ISO timestamp. */
  effective_from: string;
  effective_to: string | null;
  /** 발행 운영자. */
  published_by: string | null;
  /** 운영자가 입력한 변경 사유. */
  change_note: string | null;
};

export type ActiveTermsVersions = {
  terms_version: string;
  privacy_version: string;
  /** Server 가 추가하면 표시. 미제공이면 null. */
  marketing_version?: string | null;
  third_party_version?: string | null;
};

/**
 * 활성 약관 버전 조회 — Server `/api/v1/users/consent/active` (인증 불요) 호출.
 * 운영자 콘솔도 운영 정본을 그대로 사용 (사용자가 보는 것과 동일).
 */
export function getActiveTermsVersions(args: {
  jwt: string;
}): Promise<ServerResult<ActiveTermsVersions>> {
  // /users/consent/active 는 publicActiveVersionsView — 인증 헤더가 있어도 통과.
  return authedRequest<ActiveTermsVersions>({
    jwt: args.jwt,
    path: `/api/v1/users/consent/active`,
    method: "GET",
  });
}

/**
 * 약관 버전 목록 조회 — kind 별 모든 버전 (활성 + 이전 버전).
 * Server `/api/v1/admin/legal/terms?kind=` 도입 예정.
 */
export function listTermsVersions(args: {
  jwt: string;
  kind?: TermsKind;
}): Promise<ServerResult<{ items: TermsVersionRow[] }>> {
  const params = new URLSearchParams();
  if (args.kind) params.set("kind", args.kind);
  const qs = params.toString();
  return authedRequest<{ items: TermsVersionRow[] }>({
    jwt: args.jwt,
    path: `/api/v1/admin/legal/terms${qs ? "?" + qs : ""}`,
    method: "GET",
  });
}

/**
 * 신규 약관 버전 발행 — superadmin 전용 (server 측에서도 가드).
 */
export function publishTermsVersion(args: {
  jwt: string;
  kind: TermsKind;
  version: string;
  body_ko: string;
  body_en?: string;
  change_note: string;
  /** 발행 즉시 active 로 전환할지. false 면 staging 상태로 저장. */
  activate: boolean;
}): Promise<ServerResult<TermsVersionRow>> {
  return authedRequest<TermsVersionRow>({
    jwt: args.jwt,
    path: `/api/v1/admin/legal/terms`,
    method: "POST",
    body: {
      kind: args.kind,
      version: args.version,
      body_ko: args.body_ko,
      body_en: args.body_en ?? null,
      change_note: args.change_note,
      activate: args.activate,
    },
  });
}

/** 약관 동의 통계 — 버전별 동의 / 거부 / 마케팅 별도. */
export type ConsentStats = {
  /** 집계 시작·종료 (ISO). */
  range_start: string;
  range_end: string;
  /** kind 별 버전별 카운트. */
  by_kind: Partial<
    Record<
      TermsKind,
      Array<{
        version: string;
        granted: number;
        revoked: number;
        /** 활성 버전이면 true. */
        is_active: boolean;
      }>
    >
  >;
  /** 마케팅 동의율 (granted / total). */
  marketing_opt_in_rate: number;
  /** 총 동의 이벤트 수. */
  total_consent_events: number;
};

export function getConsentStats(args: {
  jwt: string;
  days?: number;
}): Promise<ServerResult<ConsentStats>> {
  const params = new URLSearchParams();
  if (args.days) params.set("days", String(args.days));
  const qs = params.toString();
  return authedRequest<ConsentStats>({
    jwt: args.jwt,
    path: `/api/v1/admin/legal/consent-stats${qs ? "?" + qs : ""}`,
    method: "GET",
  });
}

/** 사용자 권리 요청 종류 — PIPA 제35조(열람) / 제36조(정정·삭제) / 제37조(이관). */
export type RightsRequestKind = "access" | "rectify" | "delete" | "portability";
export type RightsRequestStatus =
  | "received"
  | "in_review"
  | "completed"
  | "rejected";

export type RightsRequestRow = {
  id: string;
  user_id: string;
  kind: RightsRequestKind;
  status: RightsRequestStatus;
  /** 사용자가 제출한 사유. */
  user_reason: string | null;
  /** 운영자가 추가한 메모. */
  operator_note: string | null;
  received_at: string;
  /** completed/rejected 일 때만. */
  closed_at: string | null;
  operator_id_closed: string | null;
};

/**
 * 사용자 권리 요청 큐 조회.
 * Server `/api/v1/admin/users/rights` 미구현 시 PIPA pending_deletion 을 augment 해 표시.
 */
export function listRightsRequests(args: {
  jwt: string;
  kind?: RightsRequestKind;
  status?: RightsRequestStatus;
  limit?: number;
}): Promise<ServerResult<{ items: RightsRequestRow[] }>> {
  const params = new URLSearchParams();
  if (args.kind) params.set("kind", args.kind);
  if (args.status) params.set("status", args.status);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest<{ items: RightsRequestRow[] }>({
    jwt: args.jwt,
    path: `/api/v1/admin/users/rights${qs ? "?" + qs : ""}`,
    method: "GET",
  });
}

/** 권리 요청 상태 전이. reason 5자 이상 강제 (server 도 검증). */
export function transitionRightsRequest(args: {
  jwt: string;
  id: string;
  next_status: RightsRequestStatus;
  reason: string;
}): Promise<ServerResult<RightsRequestRow>> {
  return authedRequest<RightsRequestRow>({
    jwt: args.jwt,
    path: `/api/v1/admin/users/rights/${encodeURIComponent(args.id)}/transition`,
    method: "POST",
    body: { next_status: args.next_status, reason: args.reason },
  });
}

/** 사업자 정보 — Server `/api/v1/legal/business-info` 도입 예정. */
export type BusinessInfoDto = {
  company_name_ko: string;
  company_name_en: string;
  ceo: string;
  business_registration_no: string;
  ecommerce_registration_no: string;
  address_ko: string;
  address_en: string;
  phone: string;
  support_email: string;
  privacy_officer: string;
  privacy_officer_email: string;
};

export function getBusinessInfo(args: {
  jwt: string;
}): Promise<ServerResult<BusinessInfoDto>> {
  return authedRequest<BusinessInfoDto>({
    jwt: args.jwt,
    path: `/api/v1/legal/business-info`,
    method: "GET",
  });
}

// ---------------------------------------------------------------------------
// (주)숨코리아 출시 정비 — Feed / Commerce / Seed admin endpoints.
//   SERVER 에이전트가 동시 작업으로 다음 endpoint 를 추가 중. requireAdmin 가드 적용.
//   본 wrapper 는 SERVER 가 아직 미배포일 때도 graceful 동작 (실패 시 ERR_NETWORK).
// ---------------------------------------------------------------------------

/** 피드 관리 — `GET /api/v1/admin/feed/posts` 응답 행 (paginated). */
export type AdminFeedPostRow = {
  id: string;
  author_id: string;
  author_handle: string | null;
  body: string;
  body_excerpt: string;
  comments_count: number;
  is_hidden: boolean;
  created_at: string;
  /** Phase B 신규 — Server 가 운영자 패널에 노출하는 정형 상태. */
  status?: "published" | "hidden" | "removed";
  /** Phase B 신규 — 가시성 범위. */
  visibility?: "public" | "followers" | "private";
  /** Phase B 신규 — 운영자 메모 (audit_log 별도). */
  moderation_note?: string | null;
};

export type AdminFeedPostsList = {
  items: AdminFeedPostRow[];
  total: number;
  page: number;
  page_size: number;
  /** Phase B 신규 — cursor 페이지네이션 응답. page-based 와 병존. */
  next_cursor?: string | null;
};

export type AdminFeedComment = {
  id: string;
  author_id: string;
  author_handle: string | null;
  body: string;
  created_at: string;
};

export type AdminFeedPostDetail = {
  post: AdminFeedPostRow;
  comments: AdminFeedComment[];
};

export function listAdminFeedPosts(args: {
  jwt: string;
  q?: string;
  hidden?: "all" | "true" | "false";
  from?: string;
  to?: string;
  page?: number;
  page_size?: number;
  /** Phase B 신규 — `published|hidden|removed` 필터. */
  status?: "published" | "hidden" | "removed";
  /** Phase B 신규 — cursor 페이지네이션. page 와 동시 사용 금지. */
  cursor?: string;
  limit?: number;
}): Promise<ServerResult<AdminFeedPostsList>> {
  const params = new URLSearchParams();
  if (args.q) params.set("q", args.q);
  if (args.hidden && args.hidden !== "all") params.set("hidden", args.hidden);
  if (args.from) params.set("from", args.from);
  if (args.to) params.set("to", args.to);
  if (typeof args.page === "number") params.set("page", String(args.page));
  if (typeof args.page_size === "number") params.set("page_size", String(args.page_size));
  if (args.status) params.set("status", args.status);
  if (args.cursor) params.set("cursor", args.cursor);
  if (typeof args.limit === "number") params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest<AdminFeedPostsList>({
    jwt: args.jwt,
    path: `/api/v1/admin/feed/posts${qs ? "?" + qs : ""}`,
    method: "GET",
  });
}

export function getAdminFeedPost(args: {
  jwt: string;
  id: string;
}): Promise<ServerResult<AdminFeedPostDetail>> {
  return authedRequest<AdminFeedPostDetail>({
    jwt: args.jwt,
    path: `/api/v1/admin/feed/posts/${encodeURIComponent(args.id)}`,
    method: "GET",
  });
}

export function patchAdminFeedPost(args: {
  jwt: string;
  id: string;
  body?: string;
  is_hidden?: boolean;
  /** Phase B 신규 — 정형 상태 토큰. Server enum: published|hidden|removed. */
  status?: "published" | "hidden" | "removed";
  /** Phase B 신규 — 가시성 범위. */
  visibility?: "public" | "followers" | "private";
  /** Phase B 신규 — 운영자 메모 (audit_log). */
  moderation_note?: string;
}): Promise<ServerResult<AdminFeedPostRow>> {
  const payload: Record<string, unknown> = {};
  if (typeof args.body === "string") payload.body = args.body;
  if (typeof args.is_hidden === "boolean") payload.is_hidden = args.is_hidden;
  if (args.status) payload.status = args.status;
  if (args.visibility) payload.visibility = args.visibility;
  if (typeof args.moderation_note === "string")
    payload.moderation_note = args.moderation_note;
  return authedRequest<AdminFeedPostRow>({
    jwt: args.jwt,
    path: `/api/v1/admin/feed/posts/${encodeURIComponent(args.id)}`,
    method: "PATCH",
    body: payload,
  });
}

export function deleteAdminFeedPost(args: {
  jwt: string;
  id: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/feed/posts/${encodeURIComponent(args.id)}`,
    method: "DELETE",
  });
}

/** 커머스 — 상품 관리. SERVER 추가 endpoint. */
export type AdminCommerceProductRow = {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  currency?: string;
  category: string | null;
  image_url: string | null;
  stock: number;
  is_deleted: boolean;
  created_at: string;
  updated_at?: string;
  /** Phase B 신규 — Woo 호환 재고 상태 토큰. */
  stock_status?: "instock" | "outofstock" | "onbackorder";
};

export type AdminCommerceProductsList = {
  items: AdminCommerceProductRow[];
  total: number;
  page: number;
  page_size: number;
  /** Phase B 신규 — cursor 페이지네이션 응답. */
  next_cursor?: string | null;
};

export function listAdminCommerceProducts(args: {
  jwt: string;
  q?: string;
  category?: string;
  only_zero_stock?: boolean;
  page?: number;
  page_size?: number;
  /** Phase B 신규 — cursor 페이지네이션. */
  cursor?: string;
  limit?: number;
}): Promise<ServerResult<AdminCommerceProductsList>> {
  const params = new URLSearchParams();
  if (args.q) params.set("q", args.q);
  if (args.category) params.set("category", args.category);
  if (args.only_zero_stock) params.set("only_zero_stock", "1");
  if (typeof args.page === "number") params.set("page", String(args.page));
  if (typeof args.page_size === "number") params.set("page_size", String(args.page_size));
  if (args.cursor) params.set("cursor", args.cursor);
  if (typeof args.limit === "number") params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest<AdminCommerceProductsList>({
    jwt: args.jwt,
    path: `/api/v1/admin/commerce/products${qs ? "?" + qs : ""}`,
    method: "GET",
  });
}

export type CreateProductInput = {
  name: string;
  description?: string;
  price: number;
  category?: string;
  image_url?: string;
  stock: number;
  /** Phase B 신규 — Woo 호환 재고 상태 토큰. 미지정 시 server 가 stock 으로 추정. */
  stock_status?: "instock" | "outofstock" | "onbackorder";
};

export function createAdminCommerceProduct(args: {
  jwt: string;
  input: CreateProductInput;
}): Promise<ServerResult<AdminCommerceProductRow>> {
  return authedRequest<AdminCommerceProductRow>({
    jwt: args.jwt,
    path: `/api/v1/admin/commerce/products`,
    method: "POST",
    body: args.input as unknown as Record<string, unknown>,
  });
}

export function updateAdminCommerceProduct(args: {
  jwt: string;
  id: string;
  patch: Partial<CreateProductInput>;
}): Promise<ServerResult<AdminCommerceProductRow>> {
  return authedRequest<AdminCommerceProductRow>({
    jwt: args.jwt,
    path: `/api/v1/admin/commerce/products/${encodeURIComponent(args.id)}`,
    method: "PATCH",
    body: args.patch as unknown as Record<string, unknown>,
  });
}

export function deleteAdminCommerceProduct(args: {
  jwt: string;
  id: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/commerce/products/${encodeURIComponent(args.id)}`,
    method: "DELETE",
  });
}

/** 커머스 — 주문 (신규 admin endpoint, EXCLUDES 결제수단/카드 details). */
export type AdminCommerceOrderItem = {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
};

export type AdminCommerceOrderStatus =
  | "pending"
  | "paid"
  | "shipping"
  | "done"
  | "cancelled";

export type AdminCommerceOrderRow = {
  id: string;
  user_id: string;
  user_email: string | null;
  total: number;
  currency?: string;
  status: AdminCommerceOrderStatus;
  item_count: number;
  created_at: string;
};

export type AdminCommerceOrdersList = {
  items: AdminCommerceOrderRow[];
  total: number;
  page: number;
  page_size: number;
};

export type AdminCommerceOrderDetail = {
  order: AdminCommerceOrderRow;
  items: AdminCommerceOrderItem[];
};

export function listAdminCommerceOrders(args: {
  jwt: string;
  status?: AdminCommerceOrderStatus | "all";
  page?: number;
  page_size?: number;
}): Promise<ServerResult<AdminCommerceOrdersList>> {
  const params = new URLSearchParams();
  if (args.status && args.status !== "all") params.set("status", args.status);
  if (typeof args.page === "number") params.set("page", String(args.page));
  if (typeof args.page_size === "number") params.set("page_size", String(args.page_size));
  const qs = params.toString();
  return authedRequest<AdminCommerceOrdersList>({
    jwt: args.jwt,
    path: `/api/v1/admin/commerce/orders${qs ? "?" + qs : ""}`,
    method: "GET",
  });
}

export function getAdminCommerceOrder(args: {
  jwt: string;
  id: string;
}): Promise<ServerResult<AdminCommerceOrderDetail>> {
  return authedRequest<AdminCommerceOrderDetail>({
    jwt: args.jwt,
    path: `/api/v1/admin/commerce/orders/${encodeURIComponent(args.id)}`,
    method: "GET",
  });
}

export function updateAdminCommerceOrderStatus(args: {
  jwt: string;
  id: string;
  status: AdminCommerceOrderStatus;
  reason?: string;
}): Promise<ServerResult<AdminCommerceOrderRow>> {
  return authedRequest<AdminCommerceOrderRow>({
    jwt: args.jwt,
    path: `/api/v1/admin/commerce/orders/${encodeURIComponent(args.id)}/status`,
    method: "PATCH",
    body: { status: args.status, ...(args.reason ? { reason: args.reason } : {}) },
  });
}

/** 운영 — 시드 상태. SERVER 가 마지막 실행 시각 + 카테고리별 카운트 반환. */
export type AdminSeedStatus = {
  last_run_at: string | null;
  last_run_by: string | null;
  duration_ms?: number | null;
  counts: Record<string, number>;
  in_progress?: boolean;
};

export type AdminSeedRunResult = {
  started_at: string;
  finished_at: string;
  duration_ms: number;
  counts: Record<string, number>;
};

export function getAdminSeedStatus(args: {
  jwt: string;
}): Promise<ServerResult<AdminSeedStatus>> {
  return authedRequest<AdminSeedStatus>({
    jwt: args.jwt,
    path: `/api/v1/admin/seed/status`,
    method: "GET",
  });
}

export function runAdminSeed(args: {
  jwt: string;
  reason?: string;
}): Promise<ServerResult<AdminSeedRunResult>> {
  return authedRequest<AdminSeedRunResult>({
    jwt: args.jwt,
    path: `/api/v1/admin/seed/run`,
    method: "POST",
    body: args.reason ? { reason: args.reason } : {},
  });
}

// ---------------------------------------------------------------------------
// V1.0 — 관측성 / SLO / 알람 / 로그 검색 / 운영 제어 (출시 정비, (주)숨코리아).
//
// SERVER 정본 endpoint (도입 또는 도입 예정):
//   GET  /api/v1/admin/metrics/slo                    — API p50/p95/p99, error rate,
//                                                       AI fallback, DB latency, deps
//   GET  /api/v1/admin/logs/search?...                — 시간/레벨/엔드포인트/uid 필터
//   GET  /api/v1/admin/alerts/config                  — 알람 임계치 + 채널 목록
//   PATCH /api/v1/admin/alerts/config/:key            — 임계치 / 활성화 토글
//   POST /api/v1/admin/ops/circuit/:name/close        — circuit breaker 강제 close
//   POST /api/v1/admin/ops/cache/invalidate           — 캐시 무효화 (selector)
//   POST /api/v1/admin/ops/maintenance                — 메인터넌스 모드 토글
//
// SERVER 미배포 endpoint 라도 page 는 graceful "—" / "준비 중" 으로 처리.
// authedRequest 가 ERR_NETWORK / ERR_NOT_FOUND 를 throw 하지 않고 표시한다.
// ---------------------------------------------------------------------------

/**
 * SLO 대시보드 — 서비스별 지표 종합. API p50/p95/p99 (ms), error rate (0~1),
 * AI fallback rate (0~1), DB 응답시간 (ms), 외부 의존성 상태.
 *
 * Server `aiHealthTracker.snapshot()` 의 단순 latency 와 달리 본 endpoint 는
 * Server 전체 라우터 layer 의 sliding window p50/p95/p99 통계. 5분 윈도우.
 */
export type SloEndpointRow = {
  /** Express 라우트 패턴 (e.g. "/api/v1/users/:id/profile"). */
  route: string;
  /** HTTP method. */
  method: string;
  /** 호출 횟수 (윈도우 내). */
  calls: number;
  /** ms. */
  p50: number;
  p95: number;
  p99: number;
  /** 5xx 비율 (0~1). */
  error_rate: number;
  /** 4xx 비율 (0~1). 인증/검증 오류 추세. */
  client_error_rate: number;
};

export type SloDependencyRow = {
  /** "db_primary" | "db_replica" | "redis" | "ai_service" | "wp_woo" | ... */
  name: string;
  /** "ok" | "degraded" | "down" | "not_applicable". */
  status: "ok" | "degraded" | "down" | "not_applicable";
  /** ms (마지막 probe 응답). */
  latency_ms: number | null;
  /** 마지막 probe 시각. */
  observed_at: string;
  /** 사람이 읽는 한 줄 설명. */
  detail: string;
};

export type SloSnapshot = {
  window_ms: number;
  observed_at: string;
  /** 전체 API 종합. */
  overall: {
    calls: number;
    p50: number;
    p95: number;
    p99: number;
    error_rate: number;
    client_error_rate: number;
  };
  /** 라우트별 TOP N (호출량 기준). */
  by_route: SloEndpointRow[];
  /** AI 호출 종합 (5분). aiHealthTracker.snapshot() 의 요약 forward. */
  ai: {
    fallback_rate: number;
    error_rate: number;
    p95_latency_ms: number;
    calls_last_minute: number;
  };
  /** DB / Redis / 외부 의존성 상태. */
  dependencies: SloDependencyRow[];
};

export function getSloSnapshot(args: {
  jwt: string;
}): Promise<ServerResult<SloSnapshot>> {
  return authedRequest<SloSnapshot>({
    jwt: args.jwt,
    path: `/api/v1/admin/metrics/slo`,
    method: "GET",
  });
}

/**
 * 알람 임계치 설정 — SLO 위반 시 자동 알람 트리거. 채널은 email/slack 다중 선택.
 * Server 미구현 endpoint 도 graceful — UI 가 기본 임계치 placeholder 표시.
 */
export type AlertChannelKind = "email" | "slack" | "webhook";

export type AlertRuleRow = {
  /** 안정적 key — "api.p95.global", "ai.fallback_rate", "db.unreachable" 등. */
  key: string;
  /** 사람이 읽는 라벨. */
  label: string;
  /** 임계치 단위 — "ms" | "rate" | "count" | "bool". */
  unit: "ms" | "rate" | "count" | "bool";
  /** 현재 임계치 — 값이 이를 넘으면 알람. unit=bool 이면 0|1. */
  threshold: number;
  /** 비활성화면 false. */
  enabled: boolean;
  /** 알림 채널 리스트. */
  channels: AlertChannelKind[];
  /** 운영자가 입력한 설명 (선택). */
  note: string | null;
  /** 마지막 수정 시각. */
  updated_at: string;
};

export type AlertConfig = {
  rules: AlertRuleRow[];
  /** 활성 채널 메타. email 주소 / slack webhook 등. */
  channels: Array<{
    kind: AlertChannelKind;
    target: string;
    /** masked = "ops-***@soomkorea.com" / "hooks.slack.com/***". */
    target_masked: string;
    enabled: boolean;
  }>;
};

export function getAlertConfig(args: {
  jwt: string;
}): Promise<ServerResult<AlertConfig>> {
  return authedRequest<AlertConfig>({
    jwt: args.jwt,
    path: `/api/v1/admin/alerts/config`,
    method: "GET",
  });
}

export function updateAlertRule(args: {
  jwt: string;
  key: string;
  patch: {
    threshold?: number;
    enabled?: boolean;
    channels?: AlertChannelKind[];
    note?: string | null;
  };
  reason: string;
}): Promise<ServerResult<AlertRuleRow>> {
  return authedRequest<AlertRuleRow>({
    jwt: args.jwt,
    path: `/api/v1/admin/alerts/config/${encodeURIComponent(args.key)}`,
    method: "PATCH",
    body: { ...args.patch, reason: args.reason },
  });
}

/**
 * 로그 검색 — Server canonical log store (NDJSON / structured) 를 운영자가
 * 시간/레벨/엔드포인트/uid 로 검색. PII (이메일/이름/전화) 는 server 가 마스킹.
 *
 * Server `/api/v1/admin/logs/search`. 미배포 시 graceful "준비 중".
 */
export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export type LogEntryRow = {
  at: string;
  level: LogLevel;
  /** 라우트 패턴. */
  route: string | null;
  method: string | null;
  status: number | null;
  /** request-id (uuid). */
  request_id: string | null;
  /** user-id (uuid). */
  user_id: string | null;
  /** operator-id (uuid). */
  operator_id: string | null;
  /** msg + extra (마스킹 후). */
  message: string;
  /** error_code (있으면). */
  error_code: string | null;
  /** 추가 컨텍스트 (마스킹 후). */
  extra: Record<string, unknown> | null;
};

export type LogSearchResult = {
  items: LogEntryRow[];
  next_cursor: string | null;
  /** 윈도우 내 추정 매칭 수 (counter — 정확 count 아님). */
  approx_total: number;
};

export function searchLogs(args: {
  jwt: string;
  /** ISO. 미지정 시 "현재로부터 1시간 전". */
  from?: string;
  to?: string;
  level?: LogLevel;
  /** route prefix 부분 매칭. */
  route?: string;
  request_id?: string;
  user_id?: string;
  /** http status — "200" | "5xx" | "4xx" 등. */
  status?: string;
  /** 자유 검색 (메시지 본문). server 가 substring match. */
  q?: string;
  cursor?: string | null;
  limit?: number;
}): Promise<ServerResult<LogSearchResult>> {
  const params = new URLSearchParams();
  if (args.from) params.set("from", args.from);
  if (args.to) params.set("to", args.to);
  if (args.level) params.set("level", args.level);
  if (args.route) params.set("route", args.route);
  if (args.request_id) params.set("request_id", args.request_id);
  if (args.user_id) params.set("user_id", args.user_id);
  if (args.status) params.set("status", args.status);
  if (args.q) params.set("q", args.q);
  if (args.cursor) params.set("cursor", args.cursor);
  if (args.limit) params.set("limit", String(args.limit));
  const qs = params.toString();
  return authedRequest<LogSearchResult>({
    jwt: args.jwt,
    path: `/api/v1/admin/logs/search${qs ? "?" + qs : ""}`,
    method: "GET",
  });
}

/**
 * 수동 운영 — circuit breaker 강제 close, 캐시 무효화, 메인터넌스 모드 토글.
 *
 * Server endpoint 미배포 시 graceful — UI 가 버튼 비활성 + 토스트 "준비 중".
 */
export function closeCircuitBreaker(args: {
  jwt: string;
  name: string;
  reason: string;
}): Promise<ServerResult<{ ok: true; name: string; state: string }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/ops/circuit/${encodeURIComponent(args.name)}/close`,
    method: "POST",
    body: { reason: args.reason },
  });
}

export function invalidateCache(args: {
  jwt: string;
  /** "all" | "personas" | "commerce_products" | "terms_active" 등. */
  selector: string;
  reason: string;
}): Promise<ServerResult<{ ok: true; selector: string; cleared: number }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/ops/cache/invalidate`,
    method: "POST",
    body: { selector: args.selector, reason: args.reason },
  });
}

export function setMaintenanceMode(args: {
  jwt: string;
  enabled: boolean;
  reason: string;
  /** 옵션: 종료 예정 시각 (ISO). */
  until?: string;
}): Promise<ServerResult<{ enabled: boolean; until: string | null }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/v1/admin/ops/maintenance`,
    method: "POST",
    body: {
      enabled: args.enabled,
      reason: args.reason,
      ...(args.until ? { until: args.until } : {}),
    },
  });
}
