"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { PanelCard } from "../_components/PanelCard";
import { LoadingState, EmptyState } from "../_components/CardStates";
import {
  fetchGeminiKeysAction,
  fetchGeminiUsageAction,
  fetchGeminiQuotaAlertsAction,
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
// 2026-06-05 — 사용자 요청: 한도 추천 제거, Text/Voice/Image 사용량 측정으로 교체.
import { progressBarColor, TIER_LABEL } from "./recommend";
import { ModelTabSelector } from "./_components/ModelTabSelector";
import {
  MODEL_KIND_LABEL,
  MODEL_KIND_ORDER,
  DEFAULT_MODEL_BY_KIND,
  decodeModelsFromNote,
  type AiModelKind,
  type ModelAssignments,
} from "@/lib/aiModelCatalog";

// 2026-06-02 — server 정식 `models` 컬럼이 비어있는 구 데이터 alias 에 한해
// note 안의 `__models__=` prefix 를 디코딩하는 폴백.
function modelsFromRow(row: GeminiKeyRow): ModelAssignments {
  const fromCol = row.models;
  if (fromCol && typeof fromCol === "object") {
    const out: ModelAssignments = {};
    for (const k of MODEL_KIND_ORDER) {
      const v = fromCol[k];
      if (typeof v === "string" && v.length > 0) out[k] = v;
    }
    if (Object.keys(out).length > 0) return out;
  }
  return decodeModelsFromNote(row.note).models;
}

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
  // 2026-06-02 — 키 등록 패널 풀열기 토글 (사용자 요청 ◈9). 기본 접힘 상태.
  const [registerOpen, setRegisterOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      {/* 2026-06-01 — 사용자 요청으로 간소화. 사용량 요약 / 알림 히스토리는 /dashboard/ai-usage 에 있어 중복 제거.
          본 페이지는 키별 진행률·tier 추천 + 키 등록·한도 설정 두 패널만 유지. */}

      {/* ───────────────── 키별 사용량 — 텍스트 / 음성 / 이미지 ─────────────────
          2026-06-05 — 사용자 요청: 한도 추천 제거, Text/Voice/Image 사용량 측정으로 교체. */}
      <PanelCard
        title="키별 사용량 — 텍스트 / 음성 / 이미지"
        description="키별로 텍스트·음성·이미지 미디어 사용량을 분류해 표시합니다. (할당 모델 기준 비례 분할 — 추후 서버 categorical_usage 직제공 예정)"
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
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
              // 2026-06-05 — server 정식 `models` 컬럼 사용 + 구 note prefix 폴백.
              const assignedModels = modelsFromRow(k);
              const assignedCount =
                MODEL_KIND_ORDER.filter((kind) => !!assignedModels[kind]).length;

              // 카테고리 → 3종 미디어 묶음.
              //   Text  = text + diary
              //   Voice = tts + stt
              //   Image = image
              // 서버가 categorical_usage 를 내려주기 전까지, 키 전체 requests_24h /
              // tokens_24h 를 "할당된 모델 수" 가중치로 비례 분할한다.
              const textKinds: AiModelKind[] = ["text", "diary"];
              const voiceKinds: AiModelKind[] = ["tts", "stt"];
              const imageKinds: AiModelKind[] = ["image"];
              const countKinds = (kinds: AiModelKind[]) =>
                kinds.reduce(
                  (acc, kind) => acc + (assignedModels[kind] ? 1 : 0),
                  0,
                );
              const textCnt = countKinds(textKinds);
              const voiceCnt = countKinds(voiceKinds);
              const imageCnt = countKinds(imageKinds);
              const totalCnt = textCnt + voiceCnt + imageCnt;

              const splitReq = (cnt: number) =>
                totalCnt > 0
                  ? Math.round((k.requests_24h * cnt) / totalCnt)
                  : 0;
              const splitTok = (cnt: number) =>
                totalCnt > 0
                  ? Math.round((k.tokens_24h * cnt) / totalCnt)
                  : 0;

              const textReq = splitReq(textCnt);
              const textTok = splitTok(textCnt);
              const voiceReq = splitReq(voiceCnt);
              const imageReq = splitReq(imageCnt);

              // 비율 — 전체 키 usage_ratio_24h 를 각 그룹에 동일하게 적용 (가중치 비례 후 정규화).
              const groupPct = (cnt: number) =>
                totalCnt > 0 && cnt > 0 ? pct : 0;
              const textPct = groupPct(textCnt);
              const voicePct = groupPct(voiceCnt);
              const imagePct = groupPct(imageCnt);

              type MediaCell = {
                label: string;
                count: number;
                pct: number;
                primary: string;
                secondary: string;
              };
              const cells: MediaCell[] = [
                {
                  label: "텍스트",
                  count: textCnt,
                  pct: textPct,
                  primary: `${fmtNumber(textReq)} req`,
                  secondary: `${fmtNumber(textTok)} tok`,
                },
                {
                  label: "음성",
                  count: voiceCnt,
                  pct: voicePct,
                  primary: `${fmtNumber(voiceReq)} req`,
                  secondary: voiceCnt > 0 ? "TTS+STT" : "미할당",
                },
                {
                  label: "이미지",
                  count: imageCnt,
                  pct: imagePct,
                  primary: `${fmtNumber(imageReq)} req`,
                  secondary: imageCnt > 0 ? "vision" : "미할당",
                },
              ];

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
                      <div className="text-[10px] text-muted">
                        텍스트 {textCnt} / 음성 {voiceCnt} / 이미지 {imageCnt}
                      </div>
                      <div className="text-[10px] text-muted">
                        합계 {fmtNumber(k.requests_24h)} req · {fmtNumber(k.tokens_24h)} tok
                      </div>
                    </div>
                  </div>

                  {assignedCount === 0 ? (
                    <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
                      측정 데이터 없음 — 이 키에 할당된 모델 카테고리가 없습니다. 아래 「키 등록 · 한도 설정」 폼에서 모델을 지정하세요.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {cells.map((cell) => {
                        const disabled = cell.count === 0;
                        const widthPct = Math.round(cell.pct * 100);
                        return (
                          <div
                            key={cell.label}
                            className={`rounded-lg border px-2 py-2 ${
                              disabled
                                ? "border-slate-200 bg-slate-50 opacity-70"
                                : "border-slate-200 bg-white"
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-[11px] font-semibold text-slate-800">
                                {cell.label}
                              </span>
                              <span className="text-[10px] font-mono text-slate-600">
                                {disabled ? "—" : `${widthPct}%`}
                              </span>
                            </div>
                            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-1">
                              <div
                                className={`h-full transition-all ${
                                  disabled
                                    ? "bg-slate-300"
                                    : progressBarColor(cell.pct)
                                }`}
                                style={{ width: `${widthPct}%` }}
                              />
                            </div>
                            <div className="text-[10px] font-mono text-slate-700 leading-tight">
                              {disabled ? "미할당" : cell.primary}
                            </div>
                            <div className="text-[10px] text-muted leading-tight">
                              {cell.secondary}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {assignedCount > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {MODEL_KIND_ORDER.map((kind) => {
                        const m = assignedModels[kind];
                        if (!m) return null;
                        return (
                          <span
                            key={kind}
                            title={`${MODEL_KIND_LABEL[kind]} → ${m}`}
                            className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-700"
                          >
                            <span className="font-semibold">
                              {MODEL_KIND_LABEL[kind]}
                            </span>
                            <span className="font-mono">{m}</span>
                          </span>
                        );
                      })}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </PanelCard>

      {/* ───────────────── 키 등록 · 한도 설정 ─────────────────
          2026-06-02 — 사용자 요청 ◈9: 풀열기 버튼을 크고 잘 보이도록 강화. 기본 접힘
          상태에서 한 번에 펼쳐 KEY·alias·tier·한도·모델 카테고리 하위탭(◈10) 까지
          한 화면에 노출. */}
      <PanelCard
        title="키 등록 · 한도 설정"
        description="API KEY 와 운영 alias / 등급 / 사용 한도 / 모델 카테고리(텍스트·이미지·일기·TTS·STT) 를 한 번에 등록합니다."
      >
        {!registerOpen ? (
          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-5">
            <div className="min-w-0">
              <div className="text-sm font-semibold text-slate-900">
                새 Gemini API KEY 등록
              </div>
              <div className="mt-0.5 text-xs text-muted">
                KEY · alias · 등급 · 한도 · 모델 카테고리(텍스트/이미지/일기/TTS/STT) 를 한 폼에서.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRegisterOpen(true)}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 text-white font-semibold text-base lg:text-lg px-6 py-3 min-h-[52px] shadow-card hover:bg-slate-800 active:scale-[0.98] transition-transform"
            >
              <span aria-hidden className="text-xl leading-none">＋</span>
              <span>키 등록 패널 열기</span>
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">
                키 등록 폼
              </div>
              <button
                type="button"
                onClick={() => setRegisterOpen(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 min-h-[36px]"
              >
                접기
              </button>
            </div>
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
                      // 2026-06-02 — server 정식 컬럼 직접 전송.
                      models: form.models,
                    });
                    if (!r.ok) {
                      setToast(`등록 실패: ${messageForCode(r.code, r.message)}`);
                    } else {
                      setToast(
                        `등록 완료: ${r.alias} → ${r.tier} (모델 ${Object.keys(form.models).length}개 지정)`,
                      );
                      reload();
                      setRegisterOpen(false);
                    }
                    resolve();
                  });
                });
              }}
            />
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-3 text-xs text-slate-700">
          <div className="font-medium mb-1 text-sm">키 평문(secret) 추가 절차 (별도)</div>
          <ol className="list-decimal pl-5 space-y-1">
            <li>https://ai.google.dev/ 에서 신규 API Key 발급 (운영자 직접)</li>
            <li>EC2 <code>.env</code> 의 <code>GEMINI_API_KEYS</code> 에 콤마 append → 서비스 재시작</li>
            <li>본 화면 위 폼에서 해당 키의 alias 와 tier·한도·모델 카테고리 등록 → 사용량 추적 시작</li>
          </ol>
          <div className="mt-2 text-[11px] text-muted">
            * 운영 규칙: 키 평문은 admin 콘솔 저장소에 영구 보관되지 않음 · 본 폼은 등록된 alias 의 metadata(quota·모델) 만 server 로 전송.
            <br />* 본 폼의 KEY 입력란은 운영자가 EC2 <code>.env</code> 반영 직전 KEY 를 1회 확인용으로 보는 용도 — 서버 응답에 평문 포함 안 함.
          </div>
        </div>
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
  /** 운영자 메모 — 모델 매핑은 별도 `models` 필드로 분리됨 (2026-06-02). */
  note: string | null;
  /** 카테고리별 모델 매핑. server 정식 컬럼으로 전송. */
  models: ModelAssignments;
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
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [alias, setAlias] = useState("");
  const [tier, setTier] = useState<GeminiKeyTier>("tier1");
  const [rpm, setRpm] = useState("");
  const [tpm, setTpm] = useState("");
  const [rpd, setRpd] = useState("");
  const [cap, setCap] = useState("");
  const [note, setNote] = useState("");
  const [models, setModels] = useState<ModelAssignments>({
    text: DEFAULT_MODEL_BY_KIND.text,
  });

  const trimmedAlias = alias.trim();
  const trimmedKey = apiKey.trim();
  const isExisting =
    trimmedAlias.length > 0 && existingAliases.includes(trimmedAlias);
  // alias 는 필수 (server quota 행 식별자). KEY 는 신규 등록 시 권장(필수는 아님 —
  // 한도만 수정하는 경우 alias 만 있어도 됨).
  const aliasValid = trimmedAlias.length >= 1 && trimmedAlias.length <= 64;
  // KEY 입력 시 형식 검증 (Google AIza 접두) — 빈 값은 OK (alias 만 갱신 케이스).
  const keyFormatOk =
    trimmedKey.length === 0 ||
    (/^AIza[0-9A-Za-z_\-]{10,}$/.test(trimmedKey) && trimmedKey.length <= 256);
  const hasAnyModel = (
    Object.keys(models) as AiModelKind[]
  ).some((k) => !!models[k]);
  const valid = aliasValid && keyFormatOk;

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
    // 2026-06-02 — 운영자 note 는 그대로 전달. 모델 매핑은 별도 `models` 필드로 전송.
    const cleanNote = note.trim();
    await onSubmit({
      alias: trimmedAlias,
      tier,
      rpm: parseInt0(rpm),
      tpm: parseInt0(tpm),
      rpd: parseInt0(rpd),
      monthly_token_cap: parseInt0(cap),
      note: cleanNote.length > 0 ? cleanNote : null,
      models,
    });
    // 성공 시 KEY 평문 즉시 폐기 (메모리 잔류 최소화). alias 도 비움.
    setApiKey("");
    setAlias("");
    setShowKey(false);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* ── 1. API KEY 입력 (마스킹 토글) ── */}
      <label className="block text-xs text-slate-700">
        <span className="font-semibold text-slate-900 text-sm">Gemini API KEY</span>
        <span className="ml-1 text-[11px] text-muted">
          (신규 키 등록 시 입력 — 한도만 수정할 땐 비워도 됨)
        </span>
        <div className="mt-1 flex gap-2">
          <input
            type={showKey ? "text" : "password"}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="AIza..."
            autoComplete="off"
            spellCheck={false}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono min-h-[44px]"
            maxLength={256}
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700 hover:bg-slate-100 min-h-[44px]"
          >
            {showKey ? "숨김" : "표시"}
          </button>
        </div>
        {!keyFormatOk ? (
          <div className="mt-1 text-[11px] text-rose-700">
            KEY 형식이 올바르지 않습니다 — Google API KEY 는 보통 <code>AIza</code> 로 시작합니다.
          </div>
        ) : trimmedKey ? (
          <div className="mt-1 text-[11px] text-emerald-700">
            KEY 형식 OK — 등록 후 EC2 <code>.env</code> <code>GEMINI_API_KEYS</code> 에 append 필요 (운영자 별도 절차).
          </div>
        ) : null}
      </label>

      {/* ── 2. alias + tier ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-slate-700">
          키 alias <span className="text-rose-600">*</span>
          <input
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
            placeholder="예: AIza#0 (server keyPool aliasFor 형식)"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono min-h-[40px]"
            maxLength={64}
          />
          {isExisting ? (
            <div className="text-[10px] text-amber-700 mt-0.5">
              기존 alias — 한도·모델이 갱신(upsert)됩니다.
            </div>
          ) : null}
        </label>
        <label className="text-xs text-slate-700">
          Tier <span className="text-rose-600">*</span>
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value as GeminiKeyTier)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm min-h-[40px]"
          >
            <option value="free">free</option>
            <option value="tier1">tier_1</option>
            <option value="tier2">tier_2</option>
            <option value="tier3">tier_3</option>
          </select>
        </label>
      </div>

      {/* ── 3. 한도 4종 ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="text-xs text-slate-700">
          RPM
          <input
            value={rpm}
            onChange={(e) => setRpm(e.target.value)}
            inputMode="numeric"
            placeholder="기본값"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono min-h-[40px]"
          />
        </label>
        <label className="text-xs text-slate-700">
          TPM
          <input
            value={tpm}
            onChange={(e) => setTpm(e.target.value)}
            inputMode="numeric"
            placeholder="기본값"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono min-h-[40px]"
          />
        </label>
        <label className="text-xs text-slate-700">
          RPD
          <input
            value={rpd}
            onChange={(e) => setRpd(e.target.value)}
            inputMode="numeric"
            placeholder="기본값"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono min-h-[40px]"
          />
        </label>
        <label className="text-xs text-slate-700">
          월 토큰 cap
          <input
            value={cap}
            onChange={(e) => setCap(e.target.value)}
            inputMode="numeric"
            placeholder="기본값"
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm font-mono min-h-[40px]"
          />
        </label>
      </div>

      {/* ── 4. 모델 카테고리 하위탭 (◈10 핵심) ── */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              모델 카테고리 선택
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              본 키로 사용할 모델 버전을 카테고리별로 지정합니다 (각 탭에서 선택).
            </div>
          </div>
          <div className="text-[11px] text-muted">
            {hasAnyModel
              ? `${MODEL_KIND_ORDER.filter((k) => !!models[k]).length}/${MODEL_KIND_ORDER.length} 카테고리 지정됨`
              : "아직 선택 없음"}
          </div>
        </div>
        <ModelTabSelector
          value={models}
          onChange={setModels}
          disabled={disabled}
        />
      </div>

      {/* ── 5. 메모 + 등록 버튼 ── */}
      <label className="block text-xs text-slate-700">
        메모 (선택)
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="예: 결제 카드 A · 2026Q3 발급"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm min-h-[40px]"
          maxLength={120}
        />
      </label>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 pt-1">
        <span className="text-[11px] text-muted sm:mr-auto">
          비워둔 한도 필드는 tier 기본값 적용. 모델 매핑은 alias 의 metadata 로 함께 저장됩니다.
        </span>
        <button
          type="submit"
          disabled={!valid || disabled}
          className="inline-flex items-center justify-center rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-base lg:text-lg px-6 py-3 min-h-[52px] shadow-card transition-colors"
        >
          {disabled
            ? "등록 중..."
            : isExisting
              ? "한도·모델 갱신"
              : "키 등록"}
        </button>
      </div>
    </form>
  );
}
