// 2026-08 (AWS→Vercel 마이그레이션) — ADMIN_DEMO_MODE=true 로 설정하면
// 실제 AWS 백엔드(ICONIA-SERVER) 없이도 데모 계정으로 로그인해 콘솔 셸을
// 둘러볼 수 있다. middleware.ts 는 쿠키의 JWT "클레임"만 디코드하고
// 서명은 검증하지 않으므로(서명 검증은 SERVER 쪽 책임), 데모 모드에서는
// 서명 없는 자체 발급 토큰으로도 인증 게이트를 통과한다.
//
// 로그인 이후의 실제 데이터 호출(lib/httpClient.ts의 authedRequest)은 모두
// AWS 실서버로 나가는데, 데모 환경에는 그 서버가 없으므로 짧게 실패시켜
// (10초 타임아웃 대신 즉시) "데모 환경 안내"로 대체한다 — overview 페이지만
// 예외적으로 lib/demoOverview.ts 의 캔드 데이터를 사용한다.

export function isDemoMode(): boolean {
  return process.env.ADMIN_DEMO_MODE === "true";
}

export const DEMO_ERROR_CODE = "ERR_DEMO_MODE";
export const DEMO_ERROR_MESSAGE =
  "데모 환경에서는 이 데이터가 실제 AWS 서버와 연동되지 않습니다. (백엔드 미연동 — 시연용 배포)";

// 데모 계정 — 실 서버 계정과 무관한 로컬 검증.
export const DEMO_CREDENTIALS: Record<string, string> = {
  test: "test",
  admin: "admin",
};

function base64url(input: string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * 서명 없는(alg:"none") 자체 발급 JWT 형태의 데모 토큰을 만든다.
 * middleware.ts 의 decodeJwtClaims 는 서명을 검증하지 않고 payload 클레임만
 * 읽으므로, exp/role 클레임만 갖춰도 인증 게이트를 통과한다.
 */
export function mintDemoJwt(args: { role: string; sub: string }): {
  jwt: string;
  expiresAt: string;
} {
  const header = { alg: "none", typ: "JWT" };
  const nowSec = Math.floor(Date.now() / 1000);
  const expSec = nowSec + 12 * 60 * 60; // 12시간
  const payload = { sub: args.sub, role: args.role, exp: expSec, iat: nowSec, demo: true };
  const jwt = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}.demo`;
  return { jwt, expiresAt: new Date(expSec * 1000).toISOString() };
}
