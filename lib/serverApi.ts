import { loadEnv } from "./env";
import type {
  LoginIssued,
  LoginStep1Response,
  LoginStep2Response,
  ServerResult,
} from "./types";

// 인증 전(pre-auth) 요청용 래퍼 — 로그인 / MFA / 로그아웃 등 Bearer 토큰 없이
// 또는 선택적으로 JWT 를 첨부하는 operator 인증 흐름 전용.
// 내부적으로 httpClient.authedRequest 를 위임하므로 timeout / 5xx 구조화 에러 /
// AbortController 가 모두 동일하게 적용된다.
async function request<T>({
  path,
  method,
  body,
  jwt,
}: {
  path: string;
  method: "GET" | "POST";
  body?: Record<string, unknown>;
  jwt?: string;
}): Promise<ServerResult<T>> {
  // authedRequest 는 jwt 가 있으면 Bearer 헤더를 추가한다.
  // 로그인 단계처럼 jwt 가 없는 경우에는 Authorization 헤더를 생략해야 하는데,
  // authedRequest 의 `jwt` 인수는 빈 문자열일 때 "Bearer " 로 보내는 것을 막아야 하므로
  // 빈 문자열이 아닐 때만 jwt 를 전달한다.
  const env = loadEnv();
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (jwt) headers["Authorization"] = `Bearer ${jwt}`;

  const DEFAULT_TIMEOUT_MS = 10_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${env.ICONIA_SERVER_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    const isTimeout = err instanceof Error && err.name === "AbortError";
    return {
      ok: false,
      code: "ERR_NETWORK",
      message: isTimeout ? "request_timeout" : "network_error",
      status: 0,
    };
  } finally {
    clearTimeout(timer);
  }

  type Envelope = {
    ok?: boolean;
    data?: unknown;
    error?: { code?: string; message?: string; details?: unknown };
  };
  let envelope: Envelope = {};
  try {
    envelope = await response.json();
  } catch {
    return {
      ok: false,
      code: "ERR_INVALID_RESPONSE",
      message: "invalid_response",
      status: response.status,
    };
  }

  // 5xx: 구조화된 에러코드가 있으면 그대로 전달 (httpClient 와 동일 정책).
  if (response.status >= 500) {
    if (envelope?.ok === false && envelope.error?.code) {
      return {
        ok: false,
        code: envelope.error.code,
        message: envelope.error.message ?? "",
        status: response.status,
        details: envelope.error.details,
      };
    }
    return {
      ok: false,
      code: "ERR_SERVER_UNAVAILABLE",
      message: "server_unavailable",
      status: response.status,
    };
  }

  if (envelope?.ok === true) {
    return { ok: true, data: envelope.data as T };
  }

  if (envelope?.ok === false && envelope.error) {
    return {
      ok: false,
      code: envelope.error.code ?? "ERR_UNKNOWN",
      message: envelope.error.message ?? "",
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
