import { loadEnv } from "./env";
import type { ServerEnvelope, ServerResult } from "./types";
import type { User360Snapshot, User360Event } from "./mockUser360";

async function getReq<T>(path: string, jwt: string): Promise<ServerResult<T>> {
  const env = loadEnv();
  let response: Response;
  try {
    response = await fetch(`${env.ICONIA_SERVER_URL}${path}`, {
      method: "GET",
      headers: { Accept: "application/json", Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });
  } catch {
    return { ok: false, code: "ERR_NETWORK", message: "network_error", status: 0 };
  }
  if (response.status >= 500) {
    return { ok: false, code: "ERR_SERVER_UNAVAILABLE", message: "server_unavailable", status: response.status };
  }
  let envelope: ServerEnvelope<T>;
  try {
    envelope = (await response.json()) as ServerEnvelope<T>;
  } catch {
    return { ok: false, code: "ERR_INVALID_RESPONSE", message: "invalid_response", status: response.status };
  }
  if (envelope && envelope.ok === true) return { ok: true, data: envelope.data };
  if (envelope && envelope.ok === false && envelope.error) {
    return { ok: false, code: envelope.error.code, message: envelope.error.message, status: response.status, details: envelope.error.details };
  }
  return { ok: false, code: "ERR_INVALID_RESPONSE", message: "invalid_response", status: response.status };
}

export function fetchUser360Snapshot(jwt: string, userId: string): Promise<ServerResult<User360Snapshot>> {
  return getReq<User360Snapshot>(`/api/v1/admin/user360/snapshot?user_id=${encodeURIComponent(userId)}`, jwt);
}

export function fetchUser360Timeline(jwt: string, userId: string, cursor?: string): Promise<ServerResult<{ items: User360Event[]; next_cursor: string | null }>> {
  const c = cursor ? `&cursor=${encodeURIComponent(cursor)}` : "";
  return getReq(`/api/v1/admin/user360/timeline?user_id=${encodeURIComponent(userId)}${c}`, jwt);
}
