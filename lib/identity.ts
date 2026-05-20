import { getOperatorMe } from "./adminApi";
import { decodeJwtPayloadUnsafe } from "./jwt";
import type { OperatorRole } from "./operatorRoles";
import { ALL_ROLES, parseRoleFromJwtPayload } from "./operatorRoles";

// `id` 는 JWT `sub` (server 가 operator UUID 를 sub 에 싣음). self-disable 가드 등
// "현재 운영자 본인" 비교에 사용. server 가 sub 을 안 실은 토큰이면 null —
// 호출자가 email fallback 필요.
export type Identity = {
  email: string;
  role: OperatorRole | null;
  id: string | null;
  /**
   * 신원 출처. `server` = `/api/v1/operator/me` 서명검증 응답 (정본),
   * `jwt` = client-decodable JWT payload fallback (Server 도달 불가 시).
   */
  source: "server" | "jwt";
};

export function readIdentityFromJwt(
  jwt: string | null | undefined,
): Identity | null {
  const payload = decodeJwtPayloadUnsafe(jwt);
  if (!payload) return null;
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!email) return null;
  const id = typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  return { email, role: parseRoleFromJwtPayload(payload), id, source: "jwt" };
}

function coerceRole(role: unknown): OperatorRole | null {
  return typeof role === "string" && (ALL_ROLES as string[]).includes(role)
    ? (role as OperatorRole)
    : null;
}

/**
 * 운영자 신원 해석 — server-side 전용.
 *
 * 우선 Server `GET /api/v1/operator/me` 로 서명검증된 신원을 조회하고,
 * Server 도달 불가(network/5xx) 또는 응답 이상 시 client-decodable JWT payload 로
 * graceful fallback 한다. 인증 자체가 실패(401/403)면 신원 없음으로 간주(null).
 *
 * 반환된 Identity 의 `source` 필드로 호출자가 신뢰도를 구분할 수 있다.
 */
export async function resolveIdentity(
  jwt: string | null | undefined,
): Promise<Identity | null> {
  if (!jwt) return null;
  let serverFailedHard = false;
  try {
    const res = await getOperatorMe({ jwt });
    if (res.ok) {
      const me = res.data;
      if (me && typeof me.email === "string" && me.email) {
        return {
          email: me.email,
          role: coerceRole(me.role),
          id: typeof me.id === "string" && me.id ? me.id : null,
          source: "server",
        };
      }
    } else if (res.status === 401 || res.status === 403) {
      // 인증 실패 — 토큰이 유효하지 않음. fallback 하지 않고 신원 없음.
      serverFailedHard = true;
    }
  } catch {
    // never throws 보장이 깨진 예외 케이스 — JWT fallback 으로 진행.
  }
  if (serverFailedHard) return null;
  // Server 도달 불가 / 응답 이상 — JWT payload fallback (degraded mode).
  return readIdentityFromJwt(jwt);
}
