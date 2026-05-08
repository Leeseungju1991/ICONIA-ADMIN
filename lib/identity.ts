import { decodeJwtPayloadUnsafe } from "./jwt";

export type Identity = { email: string };

export function readIdentityFromJwt(
  jwt: string | null | undefined,
): Identity | null {
  const payload = decodeJwtPayloadUnsafe(jwt);
  if (!payload) return null;
  const email = typeof payload.email === "string" ? payload.email : null;
  if (!email) return null;
  return { email };
}
