// 2026-06-10 — Gemini Free Tier 한도 정본.
//
// 사용자는 무료(Free) 등급 키만 등록한다 → admin 콘솔의 사용량 게이지는
// Google AI Studio Free Tier 공식 한도(2025-late 기준)로 측정한다.
//
// 공식 한도 (per key, per Google docs):
//   gemini-2.5-flash       : 10  RPM / 250K  TPM / 250  RPD
//   gemini-2.0-flash       : 15  RPM / 1M    TPM / 1500 RPD
//   gemini-2.0-flash-lite  : 30  RPM / 1M    TPM / 1500 RPD
//   gemini-2.5-pro         : 5   RPM / 250K  TPM / 100  RPD
//
// 본 콘솔은 flash 표준(2.0-flash)을 대표값으로 사용 — 페르소나 AI 가 가장 자주
// 호출하는 모델이며 RPD 1500 은 사용자가 가장 체감하기 쉬운 한도다. 모델별 분리가
// 필요해지면 본 상수만 확장한다.

export type FreeTierMetric = "rpm" | "tpm" | "rpd";

export const FREE_TIER_CAPS_PER_KEY: Record<FreeTierMetric, number> = {
  rpm: 15,
  tpm: 1_000_000,
  rpd: 1500,
};

export const FREE_TIER_MODEL_LABEL = "gemini-2.0-flash 기준";

/**
 * 활성 키 수 × per-key cap = 콘솔에 표시할 총 한도.
 * activeKeyCount 가 0/음수면 0 반환 (UI 가 graceful "한도 없음" 표시).
 */
export function freeTierTotalCap(
  metric: FreeTierMetric,
  activeKeyCount: number,
): number {
  const n = Math.max(0, Math.floor(activeKeyCount));
  return FREE_TIER_CAPS_PER_KEY[metric] * n;
}

/**
 * 한도 대비 사용량 % (0~100+). cap 이 0 이면 null.
 */
export function freeTierPercent(
  used: number,
  metric: FreeTierMetric,
  activeKeyCount: number,
): number | null {
  const cap = freeTierTotalCap(metric, activeKeyCount);
  if (cap <= 0) return null;
  return (used / cap) * 100;
}

export type FreeTierTone = "emerald" | "amber" | "rose" | "slate";

export function freeTierTone(pct: number | null): FreeTierTone {
  if (pct == null) return "slate";
  if (pct >= 95) return "rose";
  if (pct >= 80) return "amber";
  return "emerald";
}
