// 2026-06-02 — Gemini / 외부 AI 모델 카탈로그.
//
// 사용자 요구의 정본:
//   "키 등록에서는 KEY 입력하는 곳과 text, image, 일기, tts, sst 기능에 관련하여
//    사용할 버전을 하위탭으로 고를 수 있도록 변경"
//
// 본 파일은 운영자가 키 등록 시 카테고리별(text / image / diary / tts / stt) 로 사용할
// 모델 버전을 선택할 수 있도록 사전 정의된 추천 목록을 제공한다.
//
// 정책:
//   - text / image / diary 는 Gemini 가 공식 지원하므로 실모델 ID 제공.
//   - tts / stt 는 Gemini 가 공식 지원하지 않아 placeholder 만 제공 (운영자 안내 메시지 동반).
//   - 2026-06-02 — 카테고리별 모델 선택은 서버 PUT /keys/:alias/quota 의 정식
//     `models` body 필드 + GET /keys 응답의 정식 `models` 컬럼으로 전달된다.
//     본 파일의 encodeNoteWithModels / decodeModelsFromNote 는 @deprecated 상태로
//     남아 구 데이터(`note` 안 `__models__=` prefix) 폴백 디코딩에만 사용된다.

export type AiModelKind = "text" | "image" | "diary" | "tts" | "stt";

export const MODEL_KIND_ORDER: AiModelKind[] = [
  "text",
  "image",
  "diary",
  "tts",
  "stt",
];

export type AiModelOption = {
  id: string;
  label: string;
  /** 안내 한 줄 (운영자가 적합한 모델을 고르도록 돕는 짧은 설명). */
  hint?: string;
  /** Gemini 공식 미지원 — placeholder. 선택 시 안내 배너 노출. */
  unsupported?: boolean;
};

export type AiModelKindMeta = {
  label: string;
  description: string;
  /** Gemini 정식 지원 여부. false 면 placeholder + 안내. */
  geminiSupported: boolean;
  options: AiModelOption[];
};

export const MODEL_CATALOG: Record<AiModelKind, AiModelKindMeta> = {
  text: {
    label: "텍스트",
    description: "일반 대화·요약·생성 등 텍스트 처리에 사용할 모델",
    geminiSupported: true,
    options: [
      {
        id: "gemini-2.0-flash",
        label: "gemini-2.0-flash",
        hint: "기본 권장 — 빠른 응답·저비용",
      },
      {
        id: "gemini-2.0-pro",
        label: "gemini-2.0-pro",
        hint: "고품질 추론 — 비용 더 높음",
      },
      {
        id: "gemini-1.5-pro",
        label: "gemini-1.5-pro",
        hint: "이전 세대 고품질 — 호환성 폴백",
      },
      {
        id: "gemini-1.5-flash",
        label: "gemini-1.5-flash",
        hint: "이전 세대 경량 — 호환성 폴백",
      },
    ],
  },
  image: {
    label: "이미지",
    description: "이미지 인식·캡션·OCR 등 비전 처리에 사용할 모델",
    geminiSupported: true,
    options: [
      {
        id: "gemini-2.0-flash",
        label: "gemini-2.0-flash",
        hint: "권장 — 멀티모달(텍스트+이미지) 일반 처리",
      },
      {
        id: "gemini-2.0-pro",
        label: "gemini-2.0-pro",
        hint: "고품질 비전 추론",
      },
      {
        id: "gemini-1.5-pro-vision",
        label: "gemini-1.5-pro-vision",
        hint: "이전 세대 비전 전용 — 호환성 폴백",
      },
    ],
  },
  diary: {
    label: "일기",
    description: "일기 생성 / 감정 분석 / 요약 전용 모델 (텍스트 카탈로그 공유)",
    geminiSupported: true,
    options: [
      {
        id: "gemini-2.0-flash",
        label: "gemini-2.0-flash",
        hint: "권장 — 짧은 일기 자동 생성",
      },
      {
        id: "gemini-2.0-pro",
        label: "gemini-2.0-pro",
        hint: "고품질 — 감정 뉘앙스 분석",
      },
      {
        id: "gemini-1.5-pro",
        label: "gemini-1.5-pro",
        hint: "이전 세대 — 폴백",
      },
    ],
  },
  tts: {
    label: "TTS",
    description: "음성 합성 — Gemini 공식 미지원, 외부 연동 필요",
    geminiSupported: false,
    options: [
      {
        id: "placeholder-openai-tts",
        label: "(예정) OpenAI TTS",
        hint: "추후 OpenAI TTS 연동 예정",
        unsupported: true,
      },
      {
        id: "placeholder-elevenlabs",
        label: "(예정) ElevenLabs",
        hint: "추후 ElevenLabs 연동 예정",
        unsupported: true,
      },
      {
        id: "placeholder-gemini-tts",
        label: "(예정) Gemini TTS",
        hint: "Gemini 공식 TTS 지원 시 사용 예정",
        unsupported: true,
      },
    ],
  },
  stt: {
    label: "STT",
    description: "음성 인식 — Gemini 공식 미지원, 외부 연동 필요",
    geminiSupported: false,
    options: [
      {
        id: "placeholder-openai-whisper",
        label: "(예정) OpenAI Whisper",
        hint: "추후 OpenAI Whisper 연동 예정",
        unsupported: true,
      },
      {
        id: "placeholder-google-stt",
        label: "(예정) Google Cloud STT",
        hint: "추후 Google Cloud STT 연동 예정",
        unsupported: true,
      },
      {
        id: "placeholder-gemini-stt",
        label: "(예정) Gemini STT",
        hint: "Gemini 공식 STT 지원 시 사용 예정",
        unsupported: true,
      },
    ],
  },
};

export const MODEL_KIND_LABEL: Record<AiModelKind, string> = {
  text: "텍스트",
  image: "이미지",
  diary: "일기",
  tts: "TTS",
  stt: "STT",
};

/** 카테고리별 기본 선택 모델 id — 신규 등록 폼 초기값. */
export const DEFAULT_MODEL_BY_KIND: Record<AiModelKind, string> = {
  text: "gemini-2.0-flash",
  image: "gemini-2.0-flash",
  diary: "gemini-2.0-flash",
  tts: "placeholder-openai-tts",
  stt: "placeholder-openai-whisper",
};

export type ModelAssignments = Partial<Record<AiModelKind, string>>;

// ──────────────────────────────────────────────────────────────────────
// (LEGACY) metadata 인코딩 / 디코딩 — server 의 note 컬럼에 `__models__=` prefix 로
// 직렬화하던 임시 처리. 2026-06-02 server 가 PUT /keys/:alias/quota 의 body.models
// + GET /keys 응답의 `models` 컬럼을 정식 채택하면서 사실상 사용 중단.
//
// 두 함수는 한 라운드 동안 @deprecated 상태로 보존 — 운영 환경의 기존 alias note
// 안에 남아있는 prefix 를 안전하게 디코딩(decodeModelsFromNote)하여 새 컬럼이
// 비어있을 때 폴백 표시한다. 다음 라운드에서 데이터 마이그레이션 후 삭제 예정.
// ──────────────────────────────────────────────────────────────────────

const MODELS_PREFIX = "__models__=";

/**
 * @deprecated 2026-06-02 — server `models` 컬럼이 정식 채택되어 신규 호출은 사용 금지.
 *   GeminiKeyRow.models 필드 + adminApi.updateGeminiKeyQuota({ models }) 사용.
 *   본 함수는 다음 라운드에서 제거 예정 (회귀 안전을 위해 1라운드 보존).
 */
export function encodeNoteWithModels(
  note: string | null | undefined,
  models: ModelAssignments,
): string | null {
  const baseNote = String(note ?? "").trim();
  const hasAny = Object.values(models).some(
    (v) => typeof v === "string" && v.length > 0,
  );
  if (!hasAny && !baseNote) return null;
  if (!hasAny) return baseNote;
  let json: string;
  try {
    json = JSON.stringify(models);
  } catch {
    json = "{}";
  }
  const payload = `${MODELS_PREFIX}${json}`;
  if (!baseNote) return payload;
  // 운영자 note 와 model metadata 를 한 줄에 함께 보관. 길이 한도(200자) 안에서.
  return `${payload} ${baseNote}`.slice(0, 200);
}

/**
 * @deprecated 2026-06-02 — server `models` 컬럼이 정식 채택. 본 함수는 구 데이터
 *   (`note` 안에 `__models__=` prefix 가 남아있는 alias) 에 한해 폴백 디코딩
 *   용도로만 사용. 다음 라운드에서 제거 예정.
 */
export function decodeModelsFromNote(
  note: string | null | undefined,
): { models: ModelAssignments; rest: string } {
  const raw = String(note ?? "");
  const idx = raw.indexOf(MODELS_PREFIX);
  if (idx < 0) return { models: {}, rest: raw };
  const after = raw.slice(idx + MODELS_PREFIX.length);
  // JSON 직후 공백 으로 구분된 운영자 note 까지 파싱 — 빠른 깊이 1 의 단순 파서.
  const firstBrace = after.indexOf("{");
  if (firstBrace !== 0) return { models: {}, rest: raw };
  let depth = 0;
  let endIdx = -1;
  for (let i = 0; i < after.length; i += 1) {
    const c = after[i];
    if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) {
        endIdx = i;
        break;
      }
    }
  }
  if (endIdx < 0) return { models: {}, rest: raw };
  const jsonStr = after.slice(0, endIdx + 1);
  const rest = (raw.slice(0, idx) + after.slice(endIdx + 1)).trim();
  try {
    const parsed = JSON.parse(jsonStr) as ModelAssignments;
    const clean: ModelAssignments = {};
    for (const k of MODEL_KIND_ORDER) {
      const v = parsed?.[k];
      if (typeof v === "string" && v.length > 0) clean[k] = v;
    }
    return { models: clean, rest };
  } catch {
    return { models: {}, rest };
  }
}
