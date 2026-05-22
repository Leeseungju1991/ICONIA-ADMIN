"use server";

import { z } from "zod";
import { redirect } from "next/navigation";

import { writeSession } from "../authCookie";
import type { FormState } from "../types";

// Dev/demo 전용 로컬 자격증명 (2026-05-22):
//   - 본 server action 은 서버 호출 없이 soom/soom 자격증명만 통과시킨다.
//   - 2026-05-19 P0 보안 라운드(로컬 우회 제거)를 의도적으로 되돌리는 dev/demo 정책.
//   - 운영 배포 금지 — middleware/RequireAuth 는 JWT exp+role 클레임만 보므로
//     서명 없는 (alg:none) JWT 페이로드를 발급해 통과시킨다.

const schema = z.object({
  username: z.string().min(1).max(254),
  password: z.string().min(1).max(256),
});

const DEMO_USERNAME = "soom";
const DEMO_PASSWORD = "soom";
const DEMO_SESSION_TTL_SEC = 60 * 60; // 1h

function base64UrlEncode(input: string): string {
  const b64 =
    typeof btoa === "function"
      ? btoa(input)
      : Buffer.from(input, "utf8").toString("base64");
  return b64.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function mintDemoJwt(expSec: number): string {
  const header = base64UrlEncode(JSON.stringify({ alg: "none", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({ role: "superadmin", sub: DEMO_USERNAME, exp: expSec }),
  );
  return `${header}.${payload}.`;
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
    parsed.data.username !== DEMO_USERNAME ||
    parsed.data.password !== DEMO_PASSWORD
  ) {
    return { status: "error", code: "ERR_OPERATOR_INVALID_CREDENTIALS" };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + DEMO_SESSION_TTL_SEC;
  writeSession({
    jwt: mintDemoJwt(expSec),
    expiresAt: new Date(expSec * 1000).toISOString(),
  });
  redirect("/dashboard");
}
