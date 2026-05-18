// Google Fonts via next/font — CSP `font-src 'self'` 호환 (self-host).
// Roboto: Material 표준, latin only, preload.
// Noto Sans KR: 한글 글리프, swap + no-preload (~600KB woff2).
// 두 글꼴 모두 CSS variable 로 노출 — theme.ts 의 fontFamily 가 var(--font-roboto)
// → var(--font-noto-sans-kr) → system fallback 순으로 폴백.

import { Roboto, Noto_Sans_KR } from "next/font/google";

export const roboto = Roboto({
  subsets: ["latin"],
  weight: ["300", "400", "500", "700"],
  display: "swap",
  variable: "--font-roboto",
  preload: true,
});

export const notoSansKr = Noto_Sans_KR({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
  variable: "--font-noto-sans-kr",
  preload: false,
});
