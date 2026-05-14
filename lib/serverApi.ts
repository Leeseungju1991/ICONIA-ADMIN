import { loadEnv } from "./env";
import type {
  LoginIssued,
  LoginStep1Response,
  LoginStep2Response,
  ServerEnvelope,
  ServerResult,
} from "./types";

type Body = Record<string, unknown> | undefined;

type RequestArgs = {
  path: string;
  method: "GET" | "POST";
  body?: Body;
  jwt?: string;
};

async function request<T>({
  path,
  method,
  body,
  jwt,
}: RequestArgs): Promise<ServerResult<T>> {
  const env = loadEnv();
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (jwt) {
    headers["Authorization"] = `Bearer ${jwt}`;
  }

  let response: Response;
  try {
    response = await fetch(`${env.ICONIA_SERVER_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    return {
      ok: false,
      code: "ERR_NETWORK",
      message: "network_error",
      status: 0,
    };
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

  if (envelope && envelope.ok === true) {
    return { ok: true, data: envelope.data };
  }

  if (envelope && envelope.ok === false && envelope.error) {
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

export function operatorLoginStep1(args: {
  email: string;
  password: string;
}): Promise<ServerResult<LoginStep1Response>> {
  return request<LoginStep1Response>({
    path: "/api/v1/operator/login",
    method: "POST",
    body: { email: args.email, password: args.password },
  });
}

export function operatorLoginStep2(args: {
  mfaSessionToken: string;
  totp?: string;
  recoveryCode?: string;
}): Promise<ServerResult<LoginStep2Response>> {
  const body: Record<string, string> = {
    mfa_session_token: args.mfaSessionToken,
  };
  if (args.totp) body.totp = args.totp;
  if (args.recoveryCode) body.recovery_code = args.recoveryCode;
  return request<LoginStep2Response>({
    path: "/api/v1/operator/login/mfa",
    method: "POST",
    body,
  });
}

export function operatorLogout(
  jwt: string,
): Promise<ServerResult<{ revoked?: boolean } | Record<string, unknown>>> {
  return request({
    path: "/api/v1/operator/logout",
    method: "POST",
    jwt,
  });
}

export type { LoginIssued };
