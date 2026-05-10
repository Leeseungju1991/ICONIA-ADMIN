import { decodeJwtPayloadUnsafe } from "./jwt";
import type { OperatorRole } from "./operatorRoles";
import { parseRoleFromJwtPayload } from "./operatorRoles";

export type Identity = { email: string; role: OperatorRole | null };

export function readIdentityFromJwt(
  jwt: string | null | undefined,
): Identity | null {
  const payload = decodeJwtPayloadUnsafe(jwt);
  if (!payload) return null;
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!email) return null;
  return { email, role: parseRoleFromJwtPayload(payload) };
}
