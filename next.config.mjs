/** @type {import('next').NextConfig} */

// Server Actions allowedOrigins:
//   dev: localhost:3000 항상 허용.
//   prod: env ADMIN_ALLOWED_ORIGIN (콤마 구분 다중 호스트) — 누락 시 dev 만으로 동작.
// 정본: docs/api-contracts.md §2 + admin/docs/api_contract.md.
const ADMIN_ALLOWED_ORIGINS = (() => {
  const fromEnv = (process.env.ADMIN_ALLOWED_ORIGIN || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  // 항상 dev origin 포함 (개발자 로컬 개발용).
  return Array.from(new Set(["localhost:3000", ...fromEnv]));
})();

// Content Security Policy — admin 전용 (단일 운영자 콘솔, Secure JWT cookie).
//   default-src 'self'                — 기본 거절
//   script-src  'self' 'unsafe-inline' — Next.js 14 가 inline script 를 일부 사용 (nonce 도입은 별도 라운드)
//   style-src   'self' 'unsafe-inline' — inline style attribute 잦은 관용 허용
//   img-src     'self' data: https:    — WP 상품 이미지 허용 (HTTPS)
//   connect-src 'self' + Server API host — admin server 호출 (ICONIA_SERVER_URL / ADMIN_API_HOST)
//   font-src    'self' data:
//   object-src  'none'
//   frame-ancestors 'none'             — X-Frame-Options DENY 와 중복 (이중 방어)
//   form-action 'self'                 — server actions 외부 POST 차단
//   base-uri    'self'                 — base 태그 의존 XSS 경로 제거
//   upgrade-insecure-requests          — 다운그레이드 차단
// HSTS 는 reverse proxy (nginx/cloudfront) 단에서 추가하는 것이 표준이지만, 본 next.config 에서도
// 기본값을 동봉해 운영자 콘솔 자체가 누락된 경우의 1차 방어를 제공한다 (prod 한정).
const ADMIN_API_HOST = (process.env.ADMIN_API_HOST || process.env.ICONIA_SERVER_URL || "").trim();
const CONNECT_SRC = ["'self'", ADMIN_API_HOST].filter(Boolean).join(" ");
const CSP_DIRECTIVES = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  `connect-src ${CONNECT_SRC}`,
  "font-src 'self' data:",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // 운영 설정: env ADMIN_ALLOWED_ORIGIN 에 쉼표 구분 origin 나열 (admin.iconia.example).
      // 미설정 시 localhost:3000 만 허용 (개발 전용). 운영 배포 전에 반드시 설정.
      allowedOrigins: ADMIN_ALLOWED_ORIGINS,
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
