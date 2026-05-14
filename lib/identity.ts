import { decodeJwtPayloadUnsafe } from "./jwt";
import type { OperatorRole } from "./operatorRoles";
import { parseRoleFromJwtPayload } from "./operatorRoles";

// `id` 는 JWT `sub` (server 가 operator UUID 를 sub 에 싣음). self-disable 가드 등
// "현재 운영자 본인" 비교에 사용. server 가 sub 을 안 실은 토큰이면 null —
// 호출자가 email fallback 필요.
export type Identity = {
  email: string;
  role: OperatorRole | null;
  id: string | null;
};

export function readIdentityFromJwt(
  jwt: string | null | undefined,
): Identity | null {
  const payload = decodeJwtPayloadUnsafe(jwt);
  if (!payload) return null;
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!email) return null;
  const id = typeof payload.sub === "string" && payload.sub ? payload.sub : null;
  return { email, role: parseRoleFromJwtPayload(payload), id };
}
