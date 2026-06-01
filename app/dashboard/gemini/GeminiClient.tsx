"use client";

import { useEffect, useMemo, useState, useTransition, type FormEvent } from "react";
import { PanelCard } from "../_components/PanelCard";
import { LoadingState, EmptyState } from "../_components/CardStates";
import {
  fetchGeminiKeysAction,
  fetchGeminiUsageAction,
  fetchGeminiQuotaAlertsAction,
  updateGeminiKeyTierAction,
  upsertGeminiKeyQuotaAction,
} from "@/lib/actions/gemini";
import type {
  GeminiKeyRow,
  GeminiKeysResponse,
  GeminiKeyTier,
  GeminiQuotaAlertsResponse,
  GeminiUsageResponse,
} from "@/types/admin-api";
import type { GeminiTier as ServerGeminiTier } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";
import {
  recommend,
  toneClass,
  progressBarColor,
  TIER_LABEL,
  TIER_GUIDE,
  nextTier,
  type RecommendResult,
} from "./recommend";

type Range = "24h" | "7d" | "30d";

const TIER_TO_SERVER: Record<GeminiKeyTier, ServerGeminiTier> = {
  free: "free",
  tier1: "tier_1",
  tier2: "tier_2",
  tier3: "tier_3",
};

function fmtNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`;
}

export default function GeminiClient() {
  const [range, setRange] = useState<Range>("24h");
  const [keys, setKeys] = useState<GeminiKeysResponse | null>(null);
  const [usage, setUsage] = useState<GeminiUsageResponse | null>(null);
  const [usage7d, setUsage7d] = useState<GeminiUsageResponse | null>(null);
  const [usage30d, setUsage30d] = useState<GeminiUsageResponse | null>(null);
  const [alerts, setAlerts] = useState<GeminiQuotaAlertsResponse | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [loading, startLoad] = useTransition();
  const [mutating, startMutate] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  function reload() {
    startLoad(async () => {
      const [k, u, u7, u30, a] = await Promise.all([
        fetchGeminiKeysAction(),
        fetchGeminiUsageAction(range),
        fetchGeminiUsageAction("7d"),
        fetchGeminiUsageAction("30d"),
        fetchGeminiQuotaAlertsAction(),
      ]);
      if (k.ok) setKeys(k.data);
      else {
        setError({ message: k.message, code: k.code });
        setKeys(null);
      }
      if (u.ok) setUsage(u.data);
      if (u7.ok) setUsage7d(u7.data);
      if (u30.ok) setUsage30d(u30.data);
      if (a.ok) setAlerts(a.data);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  // 추천 카드 — 한 키라도 80% 도달이면 표시.
  const recommendations: Array<{ key: GeminiKeyRow; rec: RecommendResult }> = useMemo(() => {
    if (!keys) return [];
    return keys.items
      .map((k) => ({ key: k, rec: recommend(k.usage_ratio_24h, 1, k.tier) }))
      // recommend 의 usage 인자는 ratio, quota 는 1 (이미 keys[].usage_ratio_24h 가 비율).
      .filter((x) => x.rec.action !== "ok");
  }, [keys]);

  function handleUpgrade(alias: string, target: GeminiKeyTier) {
    startMutate(async () => {
      const r = await updateGeminiKeyTierAction({
        alias,
        tier: TIER_TO_SERVER[target],
      });
      if (!r.ok) {
        setToast(`tier 변경 실패: ${messageForCode(r.code, r.message)}`);
        return;
      }
      setToast(`tier 변경됨: ${alias} → ${r.tier}`);
      reload();
    });
  }

  return (
    <div className="space-y-6">
      {/* ───────────────── 1. 사용량 요약 카드 ───────────────── */}
      <PanelCard
        title="사용량 요약"
        description="24h / 7d / 30d 토큰·요청·비용. range 토글은 시계열 패널에만 영향."
        actions={
          <div className="flex items-center gap-2">
            {(["24h", "7d", "30d"] as Range[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-lg px-3 py-1.5 text-xs border ${
                  range === r
                    ? "bg-slate-900 text-white border-slate-900"
                    : "bg-white text-slate-700 border-slate-300"
                }`}
              >
                {r}
              </button>
            ))}
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300"
            >
              {loading ? "조회 중..." : "새로고침"}
            </button>
          </div>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <UsageStat label="24시간" data={usage} />
          <UsageStat label="7일" data={usage7d} />
          <UsageStat label="30일" data={usage30d} />
        </div>
      </PanelCard>

      {/* ───────────────── 2. 키별 progress bar + 3. 추천 ───────────────── */}
      <PanelCard
        title="키별 사용량"
        description="24h 한도 대비 사용량 (요청 또는 토큰 중 큰 값). 80%/95% 도달 키는 추천 카드로 표시."
      >
        {!keys && loading ? (
          <LoadingState />
        ) : !keys || keys.items.length === 0 ? (
          <EmptyState
            title="조회 가능한 키가 없습니다."
            hint={error ? messageForCode(error.code, error.message) : undefined}
          />
        ) : (
          <ul className="space-y-3">
            {keys.items.map((k) => {
              const pct = Math.min(1, k.usage_ratio_24h);
              const rec = recommend(k.usage_ratio_24h, 1, k.tier);
              return (
                <li
                  key={k.id}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="min-w-0">
                      <div className="font-medium text-slate-800 text-sm">
                        {k.label}
                      </div>
                      <div className="text-[11px] text-muted">
                        last4 …{k.last4} · tier {TIER_LABEL[k.tier]} · {k.status}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-mono text-slate-700">
                        {Math.round(pct * 100)}%
                      </div>
                      <div className="text-[10px] text-muted">
                        {fmtNumber(k.requests_24h)} req · {fmtNumber(k.tokens_24h)} tok
                      </div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className={`h-full transition-all ${progressBarColor(pct)}`}
                      style={{ width: `${Math.round(pct * 100)}%` }}
                    />
                  </div>
                  <div
                    className={`mt-2 rounded-lg border px-3 py-2 text-xs ${toneClass(rec.tone)}`}
                  >
                    <div className="font-medium">{rec.message}</div>
                    {rec.next_tier && rec.action !== "ok" && rec.action !== "monitor" ? (
                      <div className="mt-2 flex items-center gap-2">
                        <button
                          type="button"
                          disabled={mutating}
                          onClick={() => handleUpgrade(k.id, rec.next_tier!)}
                          className="rounded-md bg-white px-3 py-1 text-xs border border-current disabled:opacity-60"
                        >
                          {TIER_LABEL[rec.next_tier]} 로 상승
                        </button>
                        <span className="opacity-70">
                          ({TIER_GUIDE[rec.next_tier].notes})
                        </span>
                      </div>
                    ) : rec.action === "suggest_add_key" ? (
                      <div className="mt-1 opacity-80">
                        키 추가가 필요합니다 — 아래 「키 추가」 섹션 참조.
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      {/* ───────────────── 4. 키 추가 / 한도 등록 폼 ───────────────── */}
      <PanelCard
        title="키 등록 · 한도 설정"
        description="키 별칭(alias) 의 tier 와 한도(RPM/TPM/RPD/월간 토큰 cap)를 등록·수정합니다. 키 평문(secret)은 EC2 .env GEMINI_API_KEYS 에 운영자가 직접 추가하는 별도 절차이며 본 화면에서는 다루지 않습니다."
      >
        <KeyRegisterForm
          existingAliases={(keys?.items || []).map((k) => k.id)}
          disabled={mutating}
          onSubmit={async (form) => {
            return new Promise<void>((resolve) => {
              startMutate(async () => {
                const r = await upsertGeminiKeyQuotaAction({
                  alias: form.alias,
                  tier: TIER_TO_SERVER[form.tier],
                  rpm: form.rpm,
                  tpm: form.tpm,
                  rpd: form.rpd,
                  monthly_token_cap: form.monthly_token_cap,
                  note: form.note,
                });
                if (!r.ok) {
                  setToast(`등록 실패: ${messageForCode(r.code, r.message)}`);
                } else {
                  setToast(`등록 완료: ${r.alias} → ${r.tier}`);
                  reload();
                }
                resolve();
              });
            });
          }}
        />
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium mb-1 text-sm">키 평문(secret) 추가 절차 (별도)</div>
          <ol className="list-decimal pl-5 space-y-1">
            <li>https://ai.google.dev/ 에서 신규 API Key 발급 (운영자 직접)</li>
            <li>EC2 <code>.env</code> 의 <code>GEMINI_API_KEYS</code> 에 콤마 append → 서비스 재시작</li>
            <li>본 화면 위 폼에서 해당 키의 alias 와 tier·한도 등록 → 사용량 추적 시작</li>
          </ol>
          <div className="mt-2 text-[11px] text-muted">
            * 운영 규칙: 키 평문은 admin 콘솔에 노출되지 않음 · 본 폼은 등록된 alias 의 metadata(quota) 만 갱신.
          </div>
        </div>
        {recommendations.some((r) => r.rec.action === "suggest_add_key") ? (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            <span className="font-semibold">권장:</span> 엔터프라이즈 한도에 근접한 키가 있습니다. 신규 키 추가를 우선 검토하세요.
          </div>
        ) : null}
      </PanelCard>

      {/* ───────────────── 5. 알림 히스토리 ───────────────── */}
      <PanelCard
        title="quota 알림 히스토리"
        description="최근 20건 — open + resolved. 동일 키가 80%/95%/100% 단계로 여러 번 등록될 수 있습니다."
      >
        {!alerts ? (
          <EmptyState title="알림 데이터가 없습니다." />
        ) : alerts.items.length === 0 ? (
          <EmptyState title="quota 알림이 없습니다. 정상 운영 중." />
        ) : (
          <ul className="space-y-2 text-sm">
            {alerts.items.slice(0, 20).map((a) => (
              <li
                key={a.id}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-800">{a.key_label}</div>
                  <div className="text-[11px] text-muted">
                    opened {new Date(a.opened_at).toLocaleString("ko-KR")}
                    {a.closed_at
                      ? ` · resolved ${new Date(a.closed_at).toLocaleString("ko-KR")}`
                      : " · open"}
                  </div>
                </div>
                <span
                  className={
                    a.level === "exhausted"
                      ? "chip chip-error"
                      : a.level === "critical"
                        ? "chip chip-error"
                        : "chip chip-warn"
                  }
                >
                  {a.level} {Math.round(a.ratio * 100)}%
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card">
          {toast}
          <button
            className="ml-3 underline opacity-80"
            onClick={() => setToast(null)}
            type="button"
          >
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}

function UsageStat({
  label,
  data,
}: {
  label: string;
  data: GeminiUsageResponse | null;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <div className="text-[11px] text-muted mb-1">{label}</div>
      <div className="text-lg font-semibold text-slate-900">
        {data ? fmtNumber(data.total_requests) : "—"}{" "}
        <span className="text-xs font-normal text-muted">req</span>
      </div>
      <div className="text-xs text-slate-700 mt-0.5">
        {data ? fmtNumber(data.total_tokens) : "—"} tok
      </div>
      <div className="text-xs text-muted mt-0.5">
        {data ? fmtUsd(data.total_cost_usd) : "—"}
      </div>
    </div>
  );
}

// `nextTier` 가 GeminiClient 직접 호출되진 않지만, recommend 가 반환한 next_tier 가
// null 일 수도 있어 lint 경고 차단용으로 import 표면을 유지. 호출되진 않음.
void nextTier;

// ───────────────────────────────────────────────────────────────────────
// KeyRegisterForm — alias + tier + quota 등록 폼.
//   alias  : 키 별칭 (server keyPool aliasFor 와 일치해야 추적 매칭).
//   tier   : free / tier1 / tier2 / tier3 (server 측 enterprise 는 별도 협의).
//   rpm/tpm/rpd/monthly_token_cap : 선택 입력 — 비우면 server 가 tier 기본값 적용.
//   note   : 메모 (예: "결제 카드 A · 2026Q3 발급").
// 제출: upsertGeminiKeyQuotaAction → PUT /api/v1/admin/gemini/keys/:alias/quota.
// ───────────────────────────────────────────────────────────────────────
type FormPayload = {
  alias: string;
  tier: GeminiKeyTier;
  rpm: number | null;
  tpm: number | null;
  rpd: number | null;
  monthly_token_cap: number | null;
  note: string | null;
};

function KeyRegisterForm({
  existingAliases,
  disabled,
  onSubmit,
}: {
  existingAliases: string[];
  disabled: boolean;
  onSubmit: (form: FormPayload) => Promise<void>;
}) {
  const [alias, setAlias] = useState("");
  const [tier, setTier] = useState<GeminiKeyTier>("tier1");
  const [rpm, setRpm] = useState("");
  const [tpm, setTpm] = useState("");
  const [rpd, setRpd] = useState("");
  const [cap, setCap] = useState("");
  const [note, setNote] = useState("");

  const trimmed = alias.trim();
  const isExisting = trimmed.length > 0 && existingAliases.includes(trimmed);
  const valid = trimmed.length >= 1 && trimmed.length <= 64;

  function parseInt0(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || disabled) return;
    await onSubmit({
      alias: trimmed,
      tier,
      rpm: parseInt0(rpm),
      tpm: parseInt0(tpm),
      rpd: parseInt0(rpd),
      monthly_token_cap: parseInt0(cap),
      note: note.trim() || null,
    });
    // 성공 시 입력값 유지 (운영자가 다음 키도 비슷한 값으로 등록 가능). alias 만 비움.
    setAlias("");
  }

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-slate-700">
          키 alias <span className="text-rose-600">*</span>
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="예: AIza#0 (server keyPool aliasFor 형식)"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono"
            maxLength={64}
          />
          {isExisting ? (
            <div className="text-[10px] text-amber-700 mt-0.5">
              기존 alias — 한도가 갱신(upsert)됩니다.
            </div>
          ) : (
            <div className="text-[10px] text-muted mt-0.5">
              .env GEMINI_API_KEYS 에 추가된 키의 alias 와 정확히 일치해야 사용량 매칭됨.
            </div>
          )}
        </label>
        <label className="text-xs text-slate-700">
          Tier <span className="text-rose-600">*</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as GeminiKeyTier)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="free">free</option>
            <option value="tier1">tier_1</option>
            <option value="tier2">tier_2</option>
            <option value="tier3">tier_3</option>
          </select>
        </label>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="text-xs text-slate-700">
          RPM
          <input
            value={rpm}
            onChange={(e) => setRpm(e.target.value)}
            inputMode="numeric"
            placeholder="기본값"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono"
          />
        </label>
        <label className="text-xs text-slate-700">
          TPM
          <input
            value={tpm}
            onChange={(e) => setTpm(e.target.value)}
            inputMode="numeric"
            placeholder="기본값"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono"
          />
        </label>
        <label className="text-xs text-slate-700">
          RPD
          <input
            value={rpd}
            onChange={(e) => setRpd(e.target.value)}
            inputMode="numeric"
            placeholder="기본값"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono"
          />
        </label>
        <label className="text-xs text-slate-700">
          월 토큰 cap
          <input
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            inputMode="numeric"
            placeholder="기본값"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono"
          />
        </label>
      </div>
      <label className="block text-xs text-slate-700">
        메모 (선택)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 결제 카드 A · 2026Q3 발급"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm"
          maxLength={200}
        />
      </label>
      <div className="flex items-center justify-end gap-2">
        <span className="text-[11px] text-muted">
          비워둔 필드는 tier 기본값 적용.
        </span>
        <button
          type="submit"
          disabled={!valid || disabled}
          className="rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm px-4 py-2"
        >
          {disabled ? "등록 중..." : isExisting ? "한도 갱신" : "키 등록"}
        </button>
      </div>
    </form>
  );
}
