import GeminiClient from "./GeminiClient";

// 2026-06-01 — Gemini API Key 관리 대시보드.
//
// 사용자 요구의 정본:
//   "Gemini Key 관리는 관리자 페이지에서 이루어져야 하며, 현재 사용량,
//    사용량에 따라 어떻게 버전 업그레이드하고, 키를 몇개 늘려야 하는지,
//    구매해야 하는지를 대시보드에서 관리할수있게 만들어라"
//
// 본 페이지가 한 화면에서 답한다:
//   1) 사용량 요약 (24h / 7d / 30d) — 토큰·요청·비용
//   2) 키별 progress bar — quota 대비 사용량 %, 색상 (녹/황/적)
//   3) 업그레이드 추천 — 80%/95% 도달 시 다음 tier 또는 키 추가 권장 (recommend.ts)
//   4) 키 추가 안내
//   5) 알림 히스토리 (quota-alerts 최근 20건)
//
// /dashboard/ai-usage 와 보완 관계 — ai-usage 는 시계열·모델분포 시각화 중심,
// 본 페이지는 "관리 결정" 중심 (어떤 키를 언제 업그레이드 / 추가 할지).
export const dynamic = "force-dynamic";

export default function GeminiPage() {
  return <GeminiClient />;
}
