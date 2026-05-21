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
};

export type PostRow = {
  post_id: string;
  author_user_id: string;
  author_handle: string | null;
  body_excerpt: string;
  reaction_count: number;
  comment_count: number;
  reported_count: number;
  status: string; // 'visible' | 'hidden' | 'taken_down'
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

export type AdminOverview = {
  active_devices: number;
  dau: number;
  errors_24h: { server: number; app: number; firmware: number };
  fallback_rate: number;
  queue_depth: number;
  server_health: "ok" | "degraded" | "down";
  firmware_critical_count: number;
  reports_pending: number;
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
