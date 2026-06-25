import { cookies } from "next/headers";
import { loadEnv } from "./env";

export const AUTH_COOKIE_NAME = "iconia_admin_session";

export async function writeSession(args: {
  jwt: string;
  expiresAt: string;
}): Promise<void> {
  const env = loadEnv();
  const expMs = Date.parse(args.expiresAt);
  const nowMs = Date.now();
  const seconds = Math.max(1, Math.floor((expMs - nowMs) / 1000));
  const jar = await cookies();
  jar.set({
    name: AUTH_COOKIE_NAME,
    value: args.jwt,
    httpOnly: true,
    sameSite: "strict",
    path: "/",
    secure: env.COOKIE_SECURE,
    maxAge: seconds,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(AUTH_COOKIE_NAME);
}

export async function readSession(): Promise<string | null> {
  const jar = await cookies();
  const c = jar.get(AUTH_COOKIE_NAME);
  return c?.value ?? null;
}
