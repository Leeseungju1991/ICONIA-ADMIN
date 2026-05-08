import { loadEnv } from "./env";
import type { ServerEnvelope, ServerResult } from "./types";

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

type AuthedReq = {
  jwt: string;
  path: string;
  method: "GET" | "POST";
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
}): Promise<ServerResult<ForceLogoutResult>> {
  return authedRequest<ForceLogoutResult>({
    jwt: args.jwt,
    path: `/api/v1/admin/users/${encodeURIComponent(args.userId)}/force-logout`,
    method: "POST",
    body: {},
  });
}
