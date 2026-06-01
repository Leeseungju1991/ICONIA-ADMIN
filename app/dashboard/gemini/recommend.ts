// 2026-06-01 — Gemini 키 업그레이드 추천 로직.
//
// 사용자 요구의 정본:
//   "사용량에 따라 어떻게 버전 업그레이드하고, 키를 몇개 늘려야 하는지, 구매해야
//    하는지를 대시보드에서 관리할수있게"
//
// 규칙:
//   pct >= 0.95 → upgrade_now (한도 임박, 즉시 tier 상승 또는 키 추가)
//   pct >= 0.80 → consider_upgrade (80% 도달, 다음 tier 검토)
//   pct >= 0.50 → monitor (정상 — 50% 사용 중)
//   else        → ok (정상)
//
// enterprise tier 도달 후 95% 초과 시 → suggest_add_key (키 추가 권장).

import type { GeminiKeyTier } from "@/types/admin-api";

export type RecommendAction =
  | "ok"
  | "monitor"
  | "consider_upgrade"
  | "upgrade_now"
  | "suggest_add_key";

export type RecommendResult = {
  action: RecommendAction;
  message: string;
  /** 다음 tier 후보 (이미 enterprise 면 null). */
  next_tier: GeminiKeyTier | null;
  /** UI 색상 강조 (녹/황/적). */
  tone: "ok" | "monitor" | "warn" | "critical";
};

export const TIER_ORDER: GeminiKeyTier[] = ["free", "tier1", "tier2", "tier3"];

export const TIER_LABEL: Record<GeminiKeyTier, string> = {
  free: "Free",
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3 / Enterprise",
};

// Google Gemini API 공개 가격 / 한도 (2026-05 시점 운영자 참고용 가이드).
// 정확한 수치는 운영 환경 변수로 override 가능. 본 표는 UI 추천 메시지의
// "다음 tier 의 한도/비용" 설명에만 사용 — 실제 quota 결정은 server 가 함.
export const TIER_GUIDE: Record<
  GeminiKeyTier,
  {
    rpd_hint: number; // 일 요청 한도 (대략)
    monthly_cost_usd_hint: number; // 월 추가 비용 추정 (USD)
    notes: string;
  }
> = {
  free: { rpd_hint: 1500, monthly_cost_usd_hint: 0, notes: "무료 — 일 한도 좁음" },
  tier1: { rpd_hint: 30_000, monthly_cost_usd_hint: 50, notes: "+$50/월 — 일 한도 약 20배" },
  tier2: { rpd_hint: 100_000, monthly_cost_usd_hint: 250, notes: "+$250/월 — 일 한도 약 3배 추가" },
  tier3: { rpd_hint: 1_000_000, monthly_cost_usd_hint: 1000, notes: "+$1,000/월 — 엔터프라이즈 한도" },
};

export function nextTier(cur: GeminiKeyTier): GeminiKeyTier | null {
  const idx = TIER_ORDER.indexOf(cur);
  if (idx < 0 || idx >= TIER_ORDER.length - 1) return null;
  return TIER_ORDER[idx + 1];
}

export function recommend(
  usage: number,
  quota: number,
  tier: GeminiKeyTier,
): RecommendResult {
  // quota 가 0/null 이면 평가 불가 — ok 로 간주하고 modulator 만 표기.
  const pct = quota > 0 ? usage / quota : 0;

  // tier3 (enterprise) 도달 후 95% 이상이면 키 추가 권장.
  const isTopTier = tier === "tier3";

  if (pct >= 0.95) {
    if (isTopTier) {
      return {
        action: "suggest_add_key",
        message:
          "엔터프라이즈 한도 임박 — 더 이상 tier 상승 불가. 신규 API Key 추가 권장.",
        next_tier: null,
        tone: "critical",
      };
    }
    const nt = nextTier(tier);
    const guide = nt ? TIER_GUIDE[nt] : null;
    return {
      action: "upgrade_now",
      message: nt
        ? `한도 임박 (${Math.round(pct * 100)}%) — 즉시 ${TIER_LABEL[nt]} 로 상승. ${guide?.notes ?? ""}`
        : `한도 임박 (${Math.round(pct * 100)}%) — 키 추가 권장.`,
      next_tier: nt,
      tone: "critical",
    };
  }

  if (pct >= 0.8) {
    if (isTopTier) {
      return {
        action: "suggest_add_key",
        message: `80% 도달 (${Math.round(pct * 100)}%) — tier 더 이상 없음. 트래픽 분산용 키 추가 검토.`,
        next_tier: null,
        tone: "warn",
      };
    }
    const nt = nextTier(tier);
    const guide = nt ? TIER_GUIDE[nt] : null;
    return {
      action: "consider_upgrade",
      message: nt
        ? `80% 도달 (${Math.round(pct * 100)}%) — 다음 tier (${TIER_LABEL[nt]}) 검토. ${guide?.notes ?? ""}`
        : `80% 도달 (${Math.round(pct * 100)}%) — 다음 tier 검토.`,
      next_tier: nt,
      tone: "warn",
    };
  }

  if (pct >= 0.5) {
    return {
      action: "monitor",
      message: `정상 — ${Math.round(pct * 100)}% 사용 중. 추가 조치 불필요.`,
      next_tier: nextTier(tier),
      tone: "monitor",
    };
  }

  return {
    action: "ok",
    message: quota > 0
      ? `정상 — ${Math.round(pct * 100)}% 사용 중.`
      : "정상 — quota 미설정.",
    next_tier: nextTier(tier),
    tone: "ok",
  };
}

export function toneClass(tone: RecommendResult["tone"]): string {
  switch (tone) {
    case "critical":
      return "bg-rose-50 border-rose-200 text-rose-800";
    case "warn":
      return "bg-amber-50 border-amber-200 text-amber-800";
    case "monitor":
      return "bg-blue-50 border-blue-200 text-blue-800";
    case "ok":
    default:
      return "bg-emerald-50 border-emerald-200 text-emerald-800";
  }
}

export function progressBarColor(ratio: number): string {
  if (ratio >= 0.95) return "bg-rose-500";
  if (ratio >= 0.8) return "bg-amber-500";
  if (ratio >= 0.5) return "bg-blue-500";
  return "bg-emerald-500";
}
