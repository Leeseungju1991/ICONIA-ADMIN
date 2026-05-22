/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Brand accents (변경 없음 — 페이지 코드가 직접 참조).
        accent: "#6D5DFE",
        accentPink: "#EC4899",
        accentBlue: "#60A5FA",
        accentOrange: "#F97316",
        accentTeal: "#14B8A6",
        // NCP/NAVER Works 스타일 라이트 베이스 — 2026-05-22 재스킨.
        canvas: "#F5F6F8",   // 페이지 배경
        surface: "#FFFFFF",  // 카드/사이드바
        hairline: "#E5E7EB", // 보더 1px
      },
      boxShadow: {
        // 라이트 카드용 미세 그림자 (이전 glass blur 의 36px 감각을 12px 으로 축소).
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)",
        // primary 버튼 강조용 글로우 (NCP 보다 약간 ICONIA 다움 유지).
        soft: "0 6px 18px rgba(109, 93, 254, 0.18)",
      },
      borderRadius: {
        // 카드 12-14px / 버튼 8-10px 일관 (이전 [36px] 매크로 라운드 폐기).
        xl: "0.75rem",   // 12px
        "2xl": "1rem",   // 16px
      },
    },
  },
  plugins: [],
};
