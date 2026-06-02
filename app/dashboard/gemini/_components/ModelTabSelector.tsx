"use client";

// 2026-06-02 — 키 등록 폼의 카테고리별 모델 선택 하위탭.
//
// 사용자 요구의 정본:
//   "text, image, 일기, tts, sst 기능에 관련하여 사용할 버전을 하위탭으로 고를 수
//    있도록 변경"
//
// 카테고리(text/image/diary/tts/stt) 를 상단 탭으로 보여주고, 활성 탭에서 사전 정의된
// 모델 옵션 목록을 라디오 select 로 보여준다. tts/stt 는 Gemini 미지원이라
// placeholder 옵션 + 안내 배너 노출.

import { useState } from "react";
import {
  MODEL_CATALOG,
  MODEL_KIND_ORDER,
  MODEL_KIND_LABEL,
  type AiModelKind,
  type ModelAssignments,
} from "@/lib/aiModelCatalog";

type Props = {
  value: ModelAssignments;
  onChange: (next: ModelAssignments) => void;
  disabled?: boolean;
};

export function ModelTabSelector({ value, onChange, disabled }: Props) {
  const [active, setActive] = useState<AiModelKind>("text");
  const meta = MODEL_CATALOG[active];
  const selected = value[active] ?? "";

  function selectModel(kind: AiModelKind, modelId: string) {
    onChange({ ...value, [kind]: modelId });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      {/* ─── 탭 헤더 ─── */}
      <div
        role="tablist"
        aria-label="모델 카테고리"
        className="flex flex-wrap gap-1 border-b border-slate-200 px-2 pt-2"
      >
        {MODEL_KIND_ORDER.map((kind) => {
          const isActive = kind === active;
          const isAssigned = !!value[kind];
          return (
            <button
              key={kind}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActive(kind)}
              disabled={disabled}
              className={`relative min-h-[40px] rounded-t-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                isActive
                  ? "bg-slate-900 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {MODEL_KIND_LABEL[kind]}
              {isAssigned ? (
                <span
                  aria-hidden
                  className={`ml-1.5 inline-block h-2 w-2 rounded-full ${
                    isActive ? "bg-emerald-300" : "bg-emerald-500"
                  }`}
                  title="모델 지정됨"
                />
              ) : null}
            </button>
          );
        })}
      </div>

      {/* ─── 탭 패널 ─── */}
      <div className="p-3 sm:p-4 space-y-3" role="tabpanel">
        <div>
          <div className="text-sm font-semibold text-slate-900">
            {meta.label}
          </div>
          <div className="text-xs text-muted mt-0.5">{meta.description}</div>
        </div>

        {!meta.geminiSupported ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <span className="font-semibold">안내:</span> {meta.label} 는 Gemini
            공식 미지원입니다. 아래 옵션은 placeholder 이며, 후속 외부 연동
            (OpenAI / ElevenLabs / Google Cloud 등) 시 적용됩니다.
          </div>
        ) : null}

        <div className="space-y-2">
          {meta.options.map((opt) => {
            const isSel = opt.id === selected;
            return (
              <label
                key={opt.id}
                className={`flex items-start gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                  isSel
                    ? "border-slate-900 bg-slate-900/5"
                    : "border-slate-200 hover:border-slate-300 bg-white"
                } ${disabled ? "opacity-60 cursor-not-allowed" : ""}`}
              >
                <input
                  type="radio"
                  name={`model-${active}`}
                  value={opt.id}
                  checked={isSel}
                  onChange={() => selectModel(active, opt.id)}
                  disabled={disabled}
                  className="mt-0.5 accent-slate-900"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono text-slate-800">
                    {opt.label}
                    {opt.unsupported ? (
                      <span className="ml-2 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800 font-sans">
                        예정
                      </span>
                    ) : null}
                  </div>
                  {opt.hint ? (
                    <div className="text-[11px] text-muted mt-0.5">
                      {opt.hint}
                    </div>
                  ) : null}
                </div>
              </label>
            );
          })}
        </div>

        {selected ? (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
            <span className="text-slate-600">현재 선택</span>
            <div className="flex items-center gap-2">
              <code className="font-mono text-slate-800">{selected}</code>
              <button
                type="button"
                onClick={() => {
                  const next = { ...value };
                  delete next[active];
                  onChange(next);
                }}
                disabled={disabled}
                className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600 hover:bg-slate-100 disabled:opacity-50"
              >
                해제
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            아직 선택 안 됨 — 위 목록에서 사용할 모델을 고르세요.
          </div>
        )}
      </div>
    </div>
  );
}
