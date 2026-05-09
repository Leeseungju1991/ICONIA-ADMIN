/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // 운영 설정: NEXT_PUBLIC_ADMIN_ORIGINS 에 쉼표 구분 origin 나열 (https://admin.iconia.example).
      // 미설정 시 localhost 허용 (개발 전용). 운영 배포 전에 반드시 설정.
      allowedOrigins: (process.env.NEXT_PUBLIC_ADMIN_ORIGINS || "localhost:3000")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    },
  },
  async headers() {
    // CSP — admin web 은 외부 CDN/이미지 명시적 관제.
    //   default-src 'self'                — 기본 거절
    //   script-src  'self'                — 외부 스크립트 금지
    //   style-src   'self' 'unsafe-inline' — inline style attribute 잦은 관용 허용
    //   img-src     'self' data: https:    — WP 상품 이미지 허용 (HTTPS)
    //   connect-src 'self' + ICONIA_SERVER_URL — admin server 호출
    //   frame-ancestors 'none'             — X-Frame-Options DENY 와 중복 텍니컬·극복
    //   form-action 'self'                 — server actions 외부 POST 차단
    //   base-uri    'self'                 — base 태그 의존 XSS 경로 제거
    //   upgrade-insecure-requests          — 다운그레이드 차단
    const serverUrl = (process.env.ICONIA_SERVER_URL || "").trim();
    const connectSrc = ["'self'", serverUrl].filter(Boolean).join(" ");
    const csp = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      `connect-src ${connectSrc}`,
      "font-src 'self' data:",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "base-uri 'self'",
      "upgrade-insecure-requests",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(), interest-cohort=()" },
          { key: "Content-Security-Policy", value: csp },
          // HSTS — 1년 + 서브도메인 포함 + preload. HTTPS 경로에서만 활성.
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          // 쿼리 스트림 / cross-origin isolation 방어.
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
