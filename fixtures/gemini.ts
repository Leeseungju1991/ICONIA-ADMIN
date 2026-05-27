// 2026-05-27 — Dev-only Gemini fixture. Server `/api/admin/gemini/*` 가
// 도달 불가일 때만 NODE_ENV !== "production" 환경에서 표시. 컴포넌트 안에 박지
// 않고 fixtures/ 에 격리해 운영 빌드에선 보이지 않도록 한다.

import type {
  GeminiKeyRow,
  GeminiKeysResponse,
  GeminiQuotaAlertsResponse,
  GeminiUsageResponse,
} from "@/types/admin-api";

export const fixtureKeys: GeminiKeysResponse = {
  items: [
    {
      id: "gk_prod_1",
      label: "prod-1 (메인)",
      last4: "9XQ4",
      tier: "tier2",
      status: "active",
      requests_24h: 14_320,
      tokens_24h: 8_120_400,
      requests_mtd: 412_900,
      tokens_mtd: 234_500_000,
      requests_daily_limit: 30_000,
      tokens_daily_limit: 12_000_000,
      usage_ratio_24h: 0.68,
      last_used_at: new Date(Date.now() - 90_000).toISOString(),
    },
    {
      id: "gk_prod_2",
      label: "prod-2 (보조)",
      last4: "F7L1",
      tier: "tier2",
      status: "active",
      requests_24h: 26_410,
      tokens_24h: 11_540_200,
      requests_mtd: 720_300,
      tokens_mtd: 412_100_000,
      requests_daily_limit: 30_000,
      tokens_daily_limit: 12_000_000,
      usage_ratio_24h: 0.96,
      last_used_at: new Date(Date.now() - 12_000).toISOString(),
    },
    {
      id: "gk_canary",
      label: "canary (테스트)",
      last4: "T2K9",
      tier: "free",
      status: "active",
      requests_24h: 1_280,
      tokens_24h: 240_300,
      requests_mtd: 32_000,
      tokens_mtd: 5_900_000,
      requests_daily_limit: 1_500,
      tokens_daily_limit: 500_000,
      usage_ratio_24h: 0.85,
      last_used_at: new Date(Date.now() - 600_000).toISOString(),
    },
    {
      id: "gk_legacy",
      label: "legacy-fallback",
      last4: "M0V8",
      tier: "tier1",
      status: "cooling_down",
      requests_24h: 0,
      tokens_24h: 0,
      requests_mtd: 1_200,
      tokens_mtd: 380_000,
      requests_daily_limit: 5_000,
      tokens_daily_limit: 1_000_000,
      usage_ratio_24h: 0,
      last_used_at: new Date(Date.now() - 86_400_000).toISOString(),
    },
  ],
};

export function fixtureUsage(
  range: "24h" | "7d" | "30d",
): GeminiUsageResponse {
  const bucketCount = range === "24h" ? 24 : range === "7d" ? 7 : 30;
  const bucketMs =
    range === "24h" ? 3_600_000 : 86_400_000;
  const now = Date.now();
  const points = Array.from({ length: bucketCount }, (_, i) => {
    const idx = bucketCount - 1 - i;
    const at = new Date(now - idx * bucketMs).toISOString();
    // 사인 곡선 + 노이즈로 그럴듯하게.
    const base = range === "24h" ? 1_800 : 38_000;
    const requests = Math.round(
      base + base * 0.5 * Math.sin((idx / bucketCount) * Math.PI * 2) +
        base * 0.15 * Math.random(),
    );
    const tokens = requests * (520 + Math.round(80 * Math.random()));
    const cost_usd = Math.round((tokens / 1_000_000) * 0.35 * 100) / 100;
    return { at, requests, tokens, cost_usd };
  });
  const total_requests = points.reduce((s, p) => s + p.requests, 0);
  const total_tokens = points.reduce((s, p) => s + p.tokens, 0);
  const total_cost_usd =
    Math.round(points.reduce((s, p) => s + p.cost_usd, 0) * 100) / 100;
  return {
    range,
    points,
    by_model: [
      { model: "gemini-1.5-pro", requests: Math.round(total_requests * 0.62), tokens: Math.round(total_tokens * 0.71), cost_usd: total_cost_usd * 0.78 },
      { model: "gemini-1.5-flash", requests: Math.round(total_requests * 0.31), tokens: Math.round(total_tokens * 0.22), cost_usd: total_cost_usd * 0.18 },
      { model: "gemini-2.0-flash", requests: Math.round(total_requests * 0.07), tokens: Math.round(total_tokens * 0.07), cost_usd: total_cost_usd * 0.04 },
    ],
    total_requests,
    total_tokens,
    total_cost_usd,
  };
}

export const fixtureAlerts: GeminiQuotaAlertsResponse = {
  items: [
    {
      id: "ga_1",
      key_id: "gk_prod_2",
      key_label: "prod-2 (보조)",
      ratio: 0.96,
      level: "critical",
      opened_at: new Date(Date.now() - 8 * 60_000).toISOString(),
      closed_at: null,
    },
    {
      id: "ga_2",
      key_id: "gk_canary",
      key_label: "canary (테스트)",
      ratio: 0.85,
      level: "warn",
      opened_at: new Date(Date.now() - 32 * 60_000).toISOString(),
      closed_at: null,
    },
  ],
};

// 키 단건 80%/95% 빨강 강조 임계.
export const GEMINI_THRESHOLD_WARN = 0.8;
export const GEMINI_THRESHOLD_CRITICAL = 0.95;

export function geminiRatioTone(
  ratio: number,
): "ok" | "warn" | "critical" {
  if (ratio >= GEMINI_THRESHOLD_CRITICAL) return "critical";
  if (ratio >= GEMINI_THRESHOLD_WARN) return "warn";
  return "ok";
}

export function summarizeKeys(keys: GeminiKeyRow[]) {
  const total = keys.length;
  const active = keys.filter((k) => k.status === "active").length;
  const critical = keys.filter((k) => k.usage_ratio_24h >= GEMINI_THRESHOLD_CRITICAL).length;
  const warn = keys.filter(
    (k) => k.usage_ratio_24h >= GEMINI_THRESHOLD_WARN && k.usage_ratio_24h < GEMINI_THRESHOLD_CRITICAL,
  ).length;
  return { total, active, warn, critical };
}
