"use server";

import { redirect } from "next/navigation";

import { operatorLogout } from "../serverApi";
import { clearSession, readSession } from "../authCookie";

// idleLogoutAction — IdleTimer 가 시간 초과 시 호출.
// logoutAction 과 동일한 cleanup 을 수행하되 redirect 시 reason=idle 부착.
// 감사 §5.2 #31 / SOC2 CC6.1. 별도 server action 으로 분리한 이유:
//   1) cookie clear 는 client 가 직접 못 함 — Next.js server action 필요.
//   2) /login?reason=idle 로 redirect 시 사용자에게 명시적 메시지 노출.
//   3) logoutAction 과 분리해 audit 측면에서 "사용자 명시 로그아웃" 과
//      "idle 타임아웃 로그아웃" 을 logs 에서 구분 가능.
export async function idleLogoutAction(): Promise<void> {
  const jwt = await readSession();
  if (jwt) {
    try {
      await operatorLogout(jwt);
    } catch {
      // best-effort: cookie clear 는 보장.
    }
  }
  await clearSession();
  redirect("/login?reason=idle");
}
