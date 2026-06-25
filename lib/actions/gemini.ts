"use server";

// 2026-05-27 — Gemini API Key 사용량 server actions (◈1번).
//
// 서버 라우트 GET /api/v1/admin/gemini/keys · /usage · /quota-alerts 와 정합.
// 정본: 2. SERVER/src/routes/adminGeminiRoutes.js
//       2. SERVER/src/services/geminiKeyUsageService.js
//
// 서버 응답 스키마는 다음과 같이 운영 metric 중심으로 변환되어야 본 콘솔이 표시하는
// `GeminiKeyRow` / `GeminiUsageResponse` / `GeminiQuotaAlert` 와 정합한다:
//   /keys                                  → quota config (key_alias, tier, rpd, monthly_token_cap)
//   /usage?range=24h&groupBy=key          → 키별 24h 누적 (request_count, prompt/completion_tokens, cost)
//   /usage?range=30d&groupBy=key          → 키별 30d 누적 (월 누적 근사)
//   /usage?range=<r>&groupBy=day          → 시계열 bucket
//   /usage?range=<r>&groupBy=model        → 모델 분포
//   /quota-alerts?status=open             → 한도 알람 ledger
//
// dev fallback: server 도달 불가일 때만 fixtures/gemini.ts 데모 표시.

import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";
import {
  updateGeminiKeyQuota,
  type GeminiKeyModels,
  type GeminiTier,
} from "@/lib/adminApi";
import type {
  AdminResult,
  GeminiKeyRow,
  GeminiKeyTier,
  GeminiKeysResponse,
  GeminiModelShare,
  GeminiQuotaAlert,
  GeminiQuotaAlertsResponse,
  GeminiUsagePoint,
  GeminiUsageResponse,
} from "@/types/admin-api";
import {
  fixtureAlerts,
  fixtureKeys,
  fixtureUsage,
} from "@/fixtures/gemini";

const DEV = process.env.NODE_ENV !== "production";

function unreachable(code?: string): boolean {
  return code === "ERR_NETWORK" || code === "ERR_SERVER_UNAVAILABLE";
}

// ── 서버 응답 raw 타입 (geminiKeyUsageService 정본) ─────────────────────
type ServerKeyRow = {
  key_alias: string;
  tier: string;
  rpm: number;
  tpm: number;
  rpd: number;
  monthly_token_cap: number;
  valid_from: string;
  valid_to: string | null;
  note: string | null;
  /** 2026-06-02 — 정식 모델 컬럼 (server 배포 이전엔 undefined). */
  models?: GeminiKeyModels | null;
};
type ServerKeysResponse = { count: number; items: ServerKeyRow[] };

type ServerUsageItem = {
  key_alias?: string;
  model?: string;
  day_kst?: string;
  prompt_tokens: number;
  completion_tokens: number;
  request_count: number;
  cost_estimate_usd: number;
};
type ServerUsageResponse = {
  range: string;
  group_by: "key" | "model" | "day";
  items: ServerUsageItem[];
};

type ServerAlertRow = {
  id: string;
  key_alias: string;
  threshold: "80" | "95" | "100";
  dimension: "rpd" | "monthly_token_cap";
  day_kst: string;
  observed: number;
  limit_value: number;
  status: "open" | "resolved";
  created_at: string;
  resolved_at: string | null;
};
type ServerAlertsResponse = {
  count: number;
  status: string;
  items: ServerAlertRow[];
};

// ── 변환 헬퍼 ──────────────────────────────────────────────────────────
function normalizeTier(tier: string): GeminiKeyTier {
  const t = String(tier || "").toLowerCase().trim();
  if (t === "free") return "free";
  if (t === "tier_1" || t === "tier1") return "tier1";
  if (t === "tier_2" || t === "tier2") return "tier2";
  if (t === "tier_3" || t === "tier3" || t === "enterprise") return "tier3";
  return "free";
}

// AI 측 keyPool.aliasFor() 가 `${key.slice(0,4)}#${idx}` 형식이라 마지막 4자는 사실상
// alias 끝 4자 (예: "AIza#0" → "Iza#" 아니라 idx). 평문 키는 절대 노출하지 않으므로
// alias 자체의 마지막 4자를 표기 보조로 사용.
function last4FromAlias(alias: string): string {
  const s = String(alias || "");
  if (s.length <= 4) return s;
  return s.slice(-4);
}

function labelFromAlias(alias: string): string {
  // "AIza#0" → "Key #0 (AIza)" — 읽기 쉬운 라벨.
  const m = String(alias || "").match(/^(.{1,4}).*#(\d+)$/);
  if (m) return `Key #${m[2]} (${m[1]})`;
  return alias || "(unnamed)";
}

function ratioFor(observed: number, limit: number | null | undefined): number {
  if (!limit || limit <= 0) return 0;
  const r = observed / limit;
  return Math.max(0, Math.min(1.5, r));
}

function classifyStatus(
  ratio24h: number,
  rpd: number,
): GeminiKeyRow["status"] {
  if (rpd > 0 && ratio24h >= 1) return "exhausted";
  return "active";
}

// ── /keys ────────────────────────────────────────────────────────────
export async function fetchGeminiKeysAction(): Promise<
  AdminResult<GeminiKeysResponse> & { source: "server" | "fixture" }
> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료", source: "server" };

  // 키 quota config + 24h / 30d 키별 누적 — 3 호출 병렬.
  const [keysRes, u24Res, u30Res] = await Promise.all([
    authedRequest<ServerKeysResponse>({
      jwt,
      path: "/api/v1/admin/gemini/keys",
      method: "GET",
    }),
    authedRequest<ServerUsageResponse>({
      jwt,
      path: "/api/v1/admin/gemini/usage?range=24h&groupBy=key",
      method: "GET",
    }),
    authedRequest<ServerUsageResponse>({
      jwt,
      path: "/api/v1/admin/gemini/usage?range=30d&groupBy=key",
      method: "GET",
    }),
  ]);

  // /keys 가 도달 불가면 전체 graceful fallback.
  if (!keysRes.ok) {
    if (DEV && unreachable(keysRes.code)) {
      return { ok: true, data: fixtureKeys, source: "fixture" };
    }
    return {
      ok: false,
      code: keysRes.code,
      message: keysRes.message,
      unreachable: unreachable(keysRes.code),
      source: "server",
    };
  }

  const byAlias24 = new Map<string, ServerUsageItem>();
  if (u24Res.ok) {
    for (const it of u24Res.data.items || []) {
      if (it.key_alias) byAlias24.set(it.key_alias, it);
    }
  }
  const byAlias30 = new Map<string, ServerUsageItem>();
  if (u30Res.ok) {
    for (const it of u30Res.data.items || []) {
      if (it.key_alias) byAlias30.set(it.key_alias, it);
    }
  }

  // 등록된 quota 가 0건이고 24h usage 만 들어온 경우(=quota 미설정 키 자동 발견) 둘을 합집합.
  const allAliases = new Set<string>();
  for (const k of keysRes.data.items || []) allAliases.add(k.key_alias);
  for (const a of byAlias24.keys()) allAliases.add(a);
  for (const a of byAlias30.keys()) allAliases.add(a);

  const items: GeminiKeyRow[] = Array.from(allAliases).map((alias) => {
    const quota = keysRes.data.items.find((k) => k.key_alias === alias);
    const u24 = byAlias24.get(alias);
    const u30 = byAlias30.get(alias);

    const requests_24h = Number(u24?.request_count) || 0;
    const tokens_24h =
      (Number(u24?.prompt_tokens) || 0) + (Number(u24?.completion_tokens) || 0);
    const requests_mtd = Number(u30?.request_count) || 0;
    const tokens_mtd =
      (Number(u30?.prompt_tokens) || 0) + (Number(u30?.completion_tokens) || 0);

    const rpd = Number(quota?.rpd) || 0;
    const monthlyCap = Number(quota?.monthly_token_cap) || 0;
    // 일 토큰 한도는 RPD * 평균 응답 토큰(보수적 추정 1k) — 정밀하려면 별도 quota 도입.
    // 일단 monthly_token_cap / 30 으로 근사 노출.
    const tokensDaily = monthlyCap > 0 ? Math.floor(monthlyCap / 30) : null;

    const rRatio = ratioFor(requests_24h, rpd);
    const tRatio = ratioFor(tokens_24h, tokensDaily ?? 0);
    const usage_ratio_24h = Math.max(rRatio, tRatio);

    return {
      id: alias,
      label: labelFromAlias(alias),
      last4: last4FromAlias(alias),
      tier: normalizeTier(quota?.tier ?? "free"),
      status: classifyStatus(usage_ratio_24h, rpd),
      requests_24h,
      tokens_24h,
      requests_mtd,
      tokens_mtd,
      requests_daily_limit: rpd > 0 ? rpd : null,
      tokens_daily_limit: tokensDaily,
      usage_ratio_24h,
      last_used_at: null,
      // 2026-06-02 — note 그대로 노출. 구 데이터 호환을 위해 `__models__=` prefix
      // 가 남아있으면 UI 가 폴백 디코딩한다.
      note: quota?.note ?? null,
      // 2026-06-02 — server 정식 컬럼. 미배포 환경에서는 undefined → UI 폴백.
      models: quota?.models ?? null,
    };
  });

  return { ok: true, data: { items }, source: "server" };
}

// ── /usage ───────────────────────────────────────────────────────────
export async function fetchGeminiUsageAction(
  range: "24h" | "7d" | "30d",
): Promise<AdminResult<GeminiUsageResponse> & { source: "server" | "fixture" }> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료", source: "server" };

  const [byDayRes, byModelRes] = await Promise.all([
    authedRequest<ServerUsageResponse>({
      jwt,
      path: `/api/v1/admin/gemini/usage?range=${range}&groupBy=day`,
      method: "GET",
    }),
    authedRequest<ServerUsageResponse>({
      jwt,
      path: `/api/v1/admin/gemini/usage?range=${range}&groupBy=model`,
      method: "GET",
    }),
  ]);

  if (!byDayRes.ok) {
    if (DEV && unreachable(byDayRes.code)) {
      return { ok: true, data: fixtureUsage(range), source: "fixture" };
    }
    return {
      ok: false,
      code: byDayRes.code,
      message: byDayRes.message,
      unreachable: unreachable(byDayRes.code),
      source: "server",
    };
  }

  // day bucket → points (key_alias 가 다중이면 day 별로 합산).
  const byDay = new Map<string, GeminiUsagePoint>();
  for (const it of byDayRes.data.items || []) {
    const day = String(it.day_kst || "").trim();
    if (!day) continue;
    const tokens =
      (Number(it.prompt_tokens) || 0) + (Number(it.completion_tokens) || 0);
    const prev = byDay.get(day) ?? {
      at: `${day}T00:00:00.000Z`,
      requests: 0,
      tokens: 0,
      cost_usd: 0,
    };
    byDay.set(day, {
      at: prev.at,
      requests: prev.requests + (Number(it.request_count) || 0),
      tokens: prev.tokens + tokens,
      cost_usd: prev.cost_usd + (Number(it.cost_estimate_usd) || 0),
    });
  }
  const points: GeminiUsagePoint[] = Array.from(byDay.values()).sort((a, b) =>
    a.at.localeCompare(b.at),
  );

  const by_model: GeminiModelShare[] = (byModelRes.ok
    ? byModelRes.data.items
    : []
  )
    .filter((it) => !!it.model)
    .map((it) => ({
      model: String(it.model),
      requests: Number(it.request_count) || 0,
      tokens:
        (Number(it.prompt_tokens) || 0) + (Number(it.completion_tokens) || 0),
      cost_usd: Number(it.cost_estimate_usd) || 0,
    }));

  const total_requests = points.reduce((s, p) => s + p.requests, 0);
  const total_tokens = points.reduce((s, p) => s + p.tokens, 0);
  const total_cost_usd =
    Math.round(points.reduce((s, p) => s + p.cost_usd, 0) * 100) / 100;

  return {
    ok: true,
    data: {
      range,
      points,
      by_model,
      total_requests,
      total_tokens,
      total_cost_usd,
    },
    source: "server",
  };
}

// ── /quota-alerts ────────────────────────────────────────────────────
export async function fetchGeminiQuotaAlertsAction(): Promise<
  AdminResult<GeminiQuotaAlertsResponse> & { source: "server" | "fixture" }
> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료", source: "server" };

  const res = await authedRequest<ServerAlertsResponse>({
    jwt,
    path: "/api/v1/admin/gemini/quota-alerts?status=open",
    method: "GET",
  });

  if (!res.ok) {
    if (DEV && unreachable(res.code)) {
      return { ok: true, data: fixtureAlerts, source: "fixture" };
    }
    return {
      ok: false,
      code: res.code,
      message: res.message,
      unreachable: unreachable(res.code),
      source: "server",
    };
  }

  const items: GeminiQuotaAlert[] = (res.data.items || []).map((row) => {
    const ratio = ratioFor(row.observed, row.limit_value);
    const level: GeminiQuotaAlert["level"] =
      row.threshold === "100"
        ? "exhausted"
        : row.threshold === "95"
          ? "critical"
          : "warn";
    return {
      id: row.id,
      key_id: row.key_alias,
      key_label: labelFromAlias(row.key_alias),
      ratio,
      level,
      opened_at: row.created_at,
      closed_at: row.resolved_at,
    };
  });

  return { ok: true, data: { items }, source: "server" };
}

// ── PUT /keys/:alias/quota ───────────────────────────────────────────
// 2026-06-01 — 사용자 요청 "tier 변경" 액션. server endpoint 가 없으면 404 →
// ERR_VALIDATION/ERR_INVALID_RESPONSE 로 fall through, UI 는 graceful toast.
export type GeminiQuotaUpdateResult =
  | { ok: true; alias: string; tier: string }
  | { ok: false; message: string; code?: string };

export async function updateGeminiKeyTierAction(args: {
  alias: string;
  tier: GeminiTier;
}): Promise<GeminiQuotaUpdateResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.alias) return { ok: false, message: "alias 누락" };
  const res = await updateGeminiKeyQuota({
    jwt,
    alias: args.alias,
    tier: args.tier,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, alias: res.data.key_alias, tier: res.data.tier };
}

// 2026-06-01 — 키 alias 의 tier + 한도(rpm/tpm/rpd/monthly_token_cap) 통합 upsert.
// 키 평문(secret) 등록은 `.env GEMINI_API_KEYS` 운영 절차 — 본 액션은 등록된 alias 의
// 한도 metadata 만 갱신. server PUT /api/v1/admin/gemini/keys/:alias/quota.
export async function upsertGeminiKeyQuotaAction(args: {
  alias: string;
  tier: GeminiTier;
  rpm?: number | null;
  tpm?: number | null;
  rpd?: number | null;
  monthly_token_cap?: number | null;
  note?: string | null;
  /** 2026-06-02 — 카테고리별 모델 매핑 정식 컬럼. server 가 body.models 로 수용. */
  models?: GeminiKeyModels | null;
}): Promise<GeminiQuotaUpdateResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const alias = String(args.alias || "").trim();
  if (!alias) return { ok: false, message: "alias 누락" };
  if (alias.length > 64) return { ok: false, message: "alias 는 64자 이하" };
  const res = await updateGeminiKeyQuota({
    jwt,
    alias,
    tier: args.tier,
    rpm: args.rpm ?? null,
    tpm: args.tpm ?? null,
    rpd: args.rpd ?? null,
    monthly_token_cap: args.monthly_token_cap ?? null,
    note: args.note ?? null,
    models: args.models ?? null,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, alias: res.data.key_alias, tier: res.data.tier };
}

// ── /byok-usage ────────────────────────────────────────────────────────
// 2026-06-17 (BYOK 가시성 라운드) — 사용자 본인 키 호출 집계.
// 서버: GET /api/v1/admin/gemini/byok-usage?from&to&limit
// 응답: { range: { from, to }, total, items: [{ user_id, byok_calls,
//        prompt_tokens, completion_tokens, cost_estimate_usd, last_ts }] }
export interface ByokUsageItem {
  user_id: string;
  byok_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  cost_estimate_usd: number;
  last_ts: string | null;
}
export interface ByokUsageResponse {
  range: { from: string; to: string };
  total: number;
  items: ByokUsageItem[];
}

export async function fetchByokUsageAction(
  args?: { from?: string; to?: string; limit?: number },
): Promise<AdminResult<ByokUsageResponse> & { source: "server" }> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료", source: "server" };
  const qs = new URLSearchParams();
  if (args?.from) qs.set("from", args.from);
  if (args?.to) qs.set("to", args.to);
  if (args?.limit) qs.set("limit", String(args.limit));
  const path = `/api/v1/admin/gemini/byok-usage${qs.toString() ? `?${qs}` : ""}`;
  const res = await authedRequest<ByokUsageResponse>({
    jwt,
    path,
    method: "GET",
  });
  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: res.message,
      unreachable: unreachable(res.code),
      source: "server",
    };
  }
  return { ok: true, data: res.data, source: "server" };
}
