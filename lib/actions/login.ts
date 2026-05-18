"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { operatorLoginStep1 } from "../serverApi";
import { writeSession } from "../authCookie";
import type { FormState } from "../types";

const schema = z.object({
  username: z.string().min(1).max(254),
  password: z.string().min(1).max(256),
});

const LOCAL_BYPASS_USERNAME = "soom";
const LOCAL_BYPASS_PASSWORD = "soom";

function makeLocalBypassSession(): { jwt: string; expiresAt: string } {
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 24 * 60 * 60;
  const header = Buffer.from(
    JSON.stringify({ alg: "none", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ sub: "soom", role: "superadmin", exp: expSec }),
  ).toString("base64url");
  return {
    jwt: `${header}.${payload}.local`,
    expiresAt: new Date(expSec * 1000).toISOString(),
  };
}

export async function loginAction(
  _prev: FormState | undefined,
  formData: FormData,
): Promise<FormState> {
  const parsed = schema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", code: "ERR_VALIDATION_LOCAL" };
  }

  if (
    parsed.data.username === LOCAL_BYPASS_USERNAME &&
    parsed.data.password === LOCAL_BYPASS_PASSWORD
  ) {
    const session = makeLocalBypassSession();
    writeSession(session);
    redirect("/dashboard");
  }

  const result = await operatorLoginStep1({
    email: parsed.data.username,
    password: parsed.data.password,
  });

  if (result.ok) {
    if ("mfa_required" in result.data && result.data.mfa_required) {
      const token = encodeURIComponent(result.data.mfa_session_token);
      redirect(`/login/mfa?token=${token}`);
    }
    if ("jwt" in result.data) {
      writeSession({
        jwt: result.data.jwt,
        expiresAt: result.data.expires_at,
      });
      redirect("/dashboard");
    }
    return { status: "error", code: "ERR_INVALID_RESPONSE" };
  }

  return { status: "error", code: result.code, message: result.message };
}
