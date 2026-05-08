import { cookies } from "next/headers";
import { loadEnv } from "./env";

export const AUTH_COOKIE_NAME = "iconia_admin_session";

export function writeSession(args: {
  jwt: string;
  expiresAt: string;
}): void {
  const env = loadEnv();
  const expMs = Date.parse(args.expiresAt);
  const nowMs = Date.now();
  const seconds = Math.max(1, Math.floor((expMs - nowMs) / 1000));
  cookies().set({
    name: AUTH_COOKIE_NAME,
    value: args.jwt,
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: env.COOKIE_SECURE,
    maxAge: seconds,
  });
}

export function clearSession(): void {
  cookies().delete(AUTH_COOKIE_NAME);
}

export function readSession(): string | null {
  const c = cookies().get(AUTH_COOKIE_NAME);
  return c?.value ?? null;
}
