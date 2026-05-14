import { loadEnv } from "./env";
import type { ServerEnvelope, ServerResult } from "./types";

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

export type AiHealthSnapshot = {
  window_seconds: number;
  total_calls: number;
  fallback_count: number;
  fallback_rate: number;
  p50_latency_ms: number | null;
  p95_latency_ms: number | null;
  errors: Array<{ code: string; count: number }>;
  last_updated_at: string;
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
// Low-level authed request — same shape as before; kept as the only fetcher
// so retries/error mapping stay centralized.
// ---------------------------------------------------------------------------

type AuthedReq = {
  jwt: string;
  path: string;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
};

async function authedRequest<T>({
  jwt,
  path,
  method,
  body,
}: AuthedReq): Promise<ServerResult<T>> {
  const env = loadEnv();
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${jwt}`,
  };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response: Response;
  try {
    response = await fetch(`${env.ICONIA_SERVER_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: "ERR_NETWORK", message: "network_error", status: 0 };
  }

  let envelope: ServerEnvelope<T>;
  try {
    envelope = (await response.json()) as ServerEnvelope<T>;
  } catch {
    return {
      ok: false,
      code: "ERR_INVALID_RESPONSE",
      message: "invalid_response",
      status: response.status,
    };
  }

  if (response.status >= 500) {
    return {
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "server_unavailable",
      status: response.status,
    };
  }

  if (envelope?.ok === true) return { ok: true, data: envelope.data };
  if (envelope?.ok === false && envelope.error) {
    return {
      ok: false,
      code: envelope.error.code,
      message: envelope.error.message,
      status: response.status,
      details: envelope.error.details,
    };
  }
  return {
    ok: false,
    code: "ERR_INVALID_RESPONSE",
    message: "invalid_response",
    status: response.status,
  };
}

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

// pause/resume — Server 의 actual endpoint 는 legacy 단수형 `/api/admin/firmware/deployment/:id/...`
// (firmwareDeploymentRoutes.js). v1 plural path 는 adminStubRoutes 에서 항상 501 을 반환한다.
// 본 admin client 는 Server 변경 없이 동작하기 위해 actual path 로 단일화한다 (P0 §5.1.10c).
// 일시정지 의미는 Server 측 abort 와 동일 — pause 의미를 위해선 별도 Server 작업 필요 (후속 PR).
export function pauseDeployment(args: {
  jwt: string;
  deploymentId: string;
  reason?: string;
}): Promise<ServerResult<{ ok: true }>> {
  return authedRequest({
    jwt: args.jwt,
    path: `/api/admin/firmware/deployment/${encodeURIComponent(args.deploymentId)}/abort`,
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
