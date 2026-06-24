/** @type {import('next').NextConfig} */

// Server Actions allowedOrigins / allowedForwardedHosts:
//   dev: localhost:3000 항상 허용.
//   prod: env ADMIN_ALLOWED_ORIGIN (콤마 구분 다중 호스트) — 누락 시 dev 만으로 동작.
//   ADMIN_ALLOWED_FORWARDED_HOSTS (별도 env, 콤마 구분) — CloudFront/ALB 가 origin host 와
//     다른 값을 x-forwarded-host 에 채울 때 추가 허용 (예: CloudFront 가 Host 를 origin
//     으로 forward 하면서 ALB 의 :8082 port 가 붙은 경우). 미설정 시 ADMIN_ALLOWED_ORIGIN
//     fallback.
//
// IMPORTANT (2026-06-24): next.config.mjs 의 allowedOrigins 는 빌드 타임에 실행되어
//   required-server-files.json 에 bake 된다. 런타임 env(SSM 패치)는 이미 빌드된
//   standalone 번들에 반영되지 않는다. 따라서 no-domain PoC CF 도메인을 빌드 타임
//   상수로 포함시켜 재빌드 없이 SSM 패치만으로 완전 작동하지 않는 문제를 방지한다.
//   도메인 취득 후 ADMIN_ALLOWED_ORIGIN env 를 설정하면 그쪽이 우선 적용된다.
const ADMIN_CF_DOMAIN_FALLBACK = "dlfp1lyn34gcj.cloudfront.net";

const ADMIN_ALLOWED_ORIGINS = (() => {
  const fromEnv = (process.env.ADMIN_ALLOWED_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // 항상 dev origin + no-domain PoC CF 도메인 포함.
  // CF 도메인은 빌드 타임 상수로 포함 (runtime env 미설정 시에도 CSRF 통과).
  return Array.from(new Set(["localhost:3000", ADMIN_CF_DOMAIN_FALLBACK, ...fromEnv]));
})();
const ADMIN_ALLOWED_FORWARDED_HOSTS = (() => {
  const raw = process.env.ADMIN_ALLOWED_FORWARDED_HOSTS || process.env.ADMIN_ALLOWED_ORIGIN || "";
  const fromEnv = raw.split(",").map((s) => s.trim()).filter(Boolean);
  return Array.from(new Set(["localhost:3000", ADMIN_CF_DOMAIN_FALLBACK, ...fromEnv]));
})();

// Content Security Policy — admin 전용 (단일 운영자 콘솔, Secure JWT cookie).
//   default-src 'self'                — 기본 거절
//   script-src  'self' 'unsafe-inline' — Next.js 14 가 inline script 를 일부 사용 (nonce 도입은 별도 라운드)
//                 + 'unsafe-eval' (dev 전용) — Next dev 의 eval-source-map devtool 이 eval() 로
//                   webpack 청크를 실행하기 때문. prod 번들은 eval 없음 → 제거.
//   style-src   'self' 'unsafe-inline' — inline style attribute 잦은 관용 허용
//   img-src     'self' data: https:    — WP 상품 이미지 허용 (HTTPS)
//   connect-src 'self' + Server API host — admin server 호출 (ICONIA_SERVER_URL / ADMIN_API_HOST)
//                 + ws: localhost (dev 전용) — Next dev HMR WebSocket
//   font-src    'self' data:
//   object-src  'none'
//   frame-ancestors 'none'             — X-Frame-Options DENY 와 중복 (이중 방어)
//   form-action 'self'                 — server actions 외부 POST 차단
//   base-uri    'self'                 — base 태그 의존 XSS 경로 제거
//   upgrade-insecure-requests          — 다운그레이드 차단 (prod 만 — dev http://localhost 강제 차단 방지)
// HSTS 는 reverse proxy (nginx/cloudfront) 단에서 추가하는 것이 표준이지만, 본 next.config 에서도
// 기본값을 동봉해 운영자 콘솔 자체가 누락된 경우의 1차 방어를 제공한다 (prod 한정).
const IS_DEV = process.env.NODE_ENV !== "production";
const ADMIN_API_HOST = (process.env.ADMIN_API_HOST || process.env.ICONIA_SERVER_URL || "").trim();
const CONNECT_SRC = [
  "'self'",
  ADMIN_API_HOST,
  ...(IS_DEV ? ["ws://localhost:3000", "ws://127.0.0.1:3000"] : []),
]
  .filter(Boolean)
  .join(" ");
const SCRIPT_SRC = ["'self'", "'unsafe-inline'", ...(IS_DEV ? ["'unsafe-eval'"] : [])].join(" ");
const CSP_DIRECTIVES = [
  "default-src 'self'",
  `script-src ${SCRIPT_SRC}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  `connect-src ${CONNECT_SRC}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  // upgrade-insecure-requests 는 ALB+ACM HTTPS 도입 후 활성 (도메인 미보유 PoC 에선 disable - 브라우저가 :8082 HTTP 자산을 HTTPS 로 강제 변환해 404).
  ...(IS_DEV || process.env.DISABLE_UPGRADE_INSECURE === "1" ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Emit a minimal self-contained server bundle (.next/standalone) for the
  // Docker image (see admin/Dockerfile). Required by the ECS Fargate deploy.
  output: "standalone",
  experimental: {
    serverActions: {
      // 운영 설정: env ADMIN_ALLOWED_ORIGIN 에 쉼표 구분 origin 나열 (admin.iconia.example).
      // 미설정 시 localhost:3000 만 허용 (개발 전용). 운영 배포 전에 반드시 설정.
      allowedOrigins: ADMIN_ALLOWED_ORIGINS,
      // CloudFront → ALB origin port(:8082) 가 x-forwarded-host 에 붙어 origin 과 다를 때
      // Next 14.2 의 CSRF check 가 abort 하는 케이스 회피. ADMIN_ALLOWED_FORWARDED_HOSTS
      // (또는 fallback 으로 ADMIN_ALLOWED_ORIGIN) 의 host 들을 forwarded-host 화이트리스트로.
      allowedForwardedHosts: ADMIN_ALLOWED_FORWARDED_HOSTS,
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), interest-cohort=()" },
          { key: "Content-Security-Policy", value: CSP_DIRECTIVES },
          // HSTS: prod 에서만 1년 + includeSubDomains + preload (reverse proxy 가 동일 헤더 송신해도 멱등).
          ...(process.env.NODE_ENV === "production"
            ? [
                {
                  key: "Strict-Transport-Security",
                  value: "max-age=31536000; includeSubDomains; preload",
                },
              ]
            : []),
          // cross-origin isolation 방어.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
