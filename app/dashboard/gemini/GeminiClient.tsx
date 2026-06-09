"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { PanelCard } from "../_components/PanelCard";
import {
  fetchGeminiKeysAction,
  upsertGeminiKeyQuotaAction,
} from "@/lib/actions/gemini";
import type {
  GeminiKeysResponse,
  GeminiKeyTier,
} from "@/types/admin-api";
import type { GeminiTier as ServerGeminiTier } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";
import { ModelTabSelector } from "./_components/ModelTabSelector";
import {
  MODEL_KIND_ORDER,
  DEFAULT_MODEL_BY_KIND,
  type AiModelKind,
  type ModelAssignments,
} from "@/lib/aiModelCatalog";

const TIER_TO_SERVER: Record<GeminiKeyTier, ServerGeminiTier> = {
  free: "free",
  tier1: "tier_1",
  tier2: "tier_2",
  tier3: "tier_3",
};

export default function GeminiClient() {
  const [keys, setKeys] = useState<GeminiKeysResponse | null>(null);
  const [, startLoad] = useTransition();
  const [mutating, startMutate] = useTransition();
  const [toast, setToast] = useState<string | null>(null);
  // 2026-06-02 — 키 등록 패널 풀열기 토글 (사용자 요청 ◈9). 기본 접힘 상태.
  const [registerOpen, setRegisterOpen] = useState(false);

  function reload() {
    startLoad(async () => {
      const k = await fetchGeminiKeysAction();
      if (k.ok) setKeys(k.data);
      else setKeys(null);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      {/* 2026-06-08 — 사용자 요청: "키별 사용량 — 텍스트/음성/이미지" 패널 제거.
          본 페이지는 키 등록·한도 설정 단일 책임으로 축소. 키별 사용량 시계열은
          /dashboard/ai-usage 에서 확인. */}

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

      {/* 2026-06-09 ROLLBACK — LocalKeyStorePanel 제거.
          admin 이 평문 사용자 키를 보관/주입하는 BYOK-위반 경로를 폐기.
          이제 각 APP 사용자가 본인 Gemini 키를 Settings 에서 직접 등록한다
          (per-user 암호화 저장 — 2. SERVER user_gemini_key 테이블). admin 콘솔은
          env 기반 pooled 키(사내/시연용) 메타데이터만 관리한다. */}

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
