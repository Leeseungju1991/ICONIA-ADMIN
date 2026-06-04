// APP Shop 카테고리 라벨 풀 (관리자 커머스 목록 표시용).
//
// 2026-06-05 — 사용자 요청: 관리자 커머스 상품 목록의 카테고리 셀을 APP Shop
//   (`4. APP/src/features/commerce/api/dollsoomSeries.ts`) 에 노출되는 카테고리
//   라벨 풀 중 하나로 결정론적 랜덤 배치.
//
// 정본 출처: 4. APP/src/features/commerce/api/dollsoomSeries.ts
//   - SERIES (시리즈 5종 label_ko): 더 젬 / 아이디얼리안 / 네오르 /
//                                    스타일링 & 케어 / 아카이브
//   - SUBCATEGORIES (하위 그룹 4종 title_ko): 신상품 / 인형 / 스타일링 / 컬렉션
//   - 인기 하위 항목 label: 하이퍼젬, 리틀젬, 티니젬, ID75 남아 / 파츠, 안구,
//                            의상, 가발, 신발, 도구 / 얼터, 타임리스, 마이즈 젬,
//                            베스티지
//
// 결정론적 hash 사용 — 같은 상품 id 는 항상 같은 라벨로 매핑되어 페이지 새로고침
// 마다 카테고리가 바뀌어 UX 가 혼란스러워지는 것을 막는다.

export const APP_SHOP_CATEGORY_LABELS = [
  // 시리즈 (상위)
  "더 젬",
  "아이디얼리안",
  "네오르",
  "스타일링 & 케어",
  "아카이브",
  // 하위 그룹
  "신상품",
  "인형",
  "스타일링",
  "컬렉션",
  // 인기 하위 항목
  "하이퍼젬",
  "리틀젬",
  "티니젬",
  "ID75 남아",
  "파츠",
  "안구",
  "의상",
  "가발",
  "신발",
  "도구",
  "얼터",
  "타임리스",
  "마이즈 젬",
  "베스티지",
] as const;

export type ShopCategoryLabel = (typeof APP_SHOP_CATEGORY_LABELS)[number];

/**
 * 상품 id(또는 임의 seed 문자열) 기반 결정론적 hash 로 라벨 풀에서 하나를 선택.
 *
 * 같은 seed → 항상 같은 라벨. 다른 seed → 비교적 균등 분포 (31 prime mult).
 */
export function pickShopCategoryLabel(seed: string): ShopCategoryLabel {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return APP_SHOP_CATEGORY_LABELS[h % APP_SHOP_CATEGORY_LABELS.length];
}
