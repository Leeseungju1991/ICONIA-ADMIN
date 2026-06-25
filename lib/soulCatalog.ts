// ICONIA SOUL 카탈로그 — admin 전용 (APP displayData.ts 와 동기화).
// soul_catalog_id → 한국어 표시이름 단순 매핑.
//
// Why: 서버 V 라운드 soul_name 평탄화가 미완료인 상태에서
//   soul_catalog_id 만 내려오고 soul_name 이 비거나 기술 식별자
//   (예: "seed doll 20") 가 들어올 때 admin 이 정본 한국어명을
//   표시할 수 있도록 한다.
//   서버가 정상적으로 soul_name 을 내려주면 이 맵은 fallback 으로만 쓰인다.
//
// 2026-06-24 — 24종 정본 (PDF 기준) + deprecated 12종 호환.
// 2026-06-25 — SOUL_CANONICAL_COUNT = 24 export 추가.
//   SOUL_CATALOG_LABELS 전체를 Object.keys().length 로 세면 36이 나오므로
//   운영 정본(24종) 카운트는 반드시 이 상수를 사용한다.

/** 운영 정본 SOUL ID — PDF 24종 (알파벳 순). */
export const SOUL_CANONICAL_IDS: readonly string[] = [
  "aira", "ann", "aoi", "ash", "asha",
  "bell", "caio", "elin", "hart", "hlyssa",
  "iseo", "lin", "log", "lyra", "malia",
  "miquel", "nix", "noam", "ram", "rio",
  "silviette", "teo", "van", "vivianne",
] as const;

/** 운영 정본 카탈로그 수 — 화면 표시 전용. SOUL_CATALOG_LABELS 키 수(36)와 혼용 금지. */
export const SOUL_CANONICAL_COUNT = SOUL_CANONICAL_IDS.length; // 24

export const SOUL_CATALOG_LABELS: Record<string, string> = {
  // PDF 24종 (알파벳)
  aira:      "아이라",
  ann:       "앤",
  aoi:       "아오이",
  ash:       "애쉬",
  asha:      "아샤",
  bell:      "벨",
  caio:      "카이오",
  elin:      "엘린",
  hart:      "하트",
  hlyssa:    "흘리사",
  iseo:      "이서",
  lin:       "린",
  log:       "로그",
  lyra:      "리라",
  malia:     "말리아",
  miquel:    "미겔",
  nix:       "닉스",
  noam:      "노암",
  ram:       "람",
  rio:       "리오",
  silviette: "실비엣",
  teo:       "테오",
  van:       "반",
  vivianne:  "비비안",
  // deprecated 12종 (DB 호환 — 기존 사용자 데이터 표시 보존)
  ehlard:  "엘하르드",
  noah:    "노아",
  sion:    "시온",
  cillian: "실리안",
  erin:    "에린",
  ailon:   "아일론",
  aiden:   "에이든",
  paeron:  "페이론",
  darian:  "다리안",
  ian:     "이안",
  kaen:    "카엔",
  draven:  "드레이븐",
};

/**
 * soul_catalog_id 로 한국어 표시이름을 조회한다.
 * 미등록 ID 는 null 반환 (호출 측에서 fallback 처리).
 */
export function soulLabel(soulCatalogId: string | null | undefined): string | null {
  if (!soulCatalogId) return null;
  return SOUL_CATALOG_LABELS[soulCatalogId.trim()] ?? null;
}

/**
 * soul_catalog_id 가 운영 정본 24종에 속하는지 확인.
 * deprecated 12종은 false 반환.
 */
export function isSoulCanonical(soulCatalogId: string): boolean {
  return SOUL_CANONICAL_IDS.includes(soulCatalogId.trim());
}
