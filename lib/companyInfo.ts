// (주)숨코리아 / Soom Korea Inc. — 운영자 콘솔이 표시하는 회사 정보 placeholder.
//
// 본 모듈은 Server `/api/v1/legal/business-info` 가 도입되기 전까지의 정본이다.
// Server 라우트가 추가되면 `lib/adminApi.ts: getBusinessInfo` 로 fetch 한 값으로
// 즉시 swap 가능하도록 동일 shape 의 타입과 fallback 값을 제공한다.
//
// 정책:
//   - 사업자등록번호 / 통신판매업 / 대표자명 등 외부 노출 가능 정보만 정의.
//   - 내부 운영자만 보는 footer / About 영역에서 사용.
//   - Sidebar footer + /dashboard/legal 페이지가 본 모듈을 import.
//
// Source of truth (cross-repo):
//   - `6. CI/docs/legal/business-info.md` 가 회사 정보 단일 정본.
//   - 이메일 도메인은 `dollsoom.com` — companyInfo.ts 도 동일.
//   - 사업자등록번호·CEO·주소·통신판매업 신고번호는 사업자 등록 완료 후 갱신.

export type BusinessInfo = {
  /** 상호 (한글). */
  company_name_ko: string;
  /** 상호 (영문). */
  company_name_en: string;
  /** 대표자. */
  ceo: string;
  /** 사업자등록번호 (000-00-00000). */
  business_registration_no: string;
  /** 통신판매업 신고번호. */
  ecommerce_registration_no: string;
  /** 본사 주소 (한글). */
  address_ko: string;
  /** 본사 주소 (영문). */
  address_en: string;
  /** 대표 전화. */
  phone: string;
  /** 고객지원 이메일. */
  support_email: string;
  /** 개인정보보호책임자 (DPO) 이름. */
  privacy_officer: string;
  /** 개인정보보호책임자 이메일. */
  privacy_officer_email: string;
  /** placeholder 여부 — true 인 경우 Server `/api/v1/legal/business-info` 미연동. */
  placeholder: boolean;
};

// TODO(server): /api/v1/legal/business-info 도입 후 본 placeholder 의 실제 값으로
// 교체. 본 라운드는 출시 직전 표시 정합을 위해 (주)숨코리아 정보를 박아둔다.
// 실제 사업자등록번호·신고번호는 등록 완료 후 입력. 등록 전에는 "출시 전 등록 예정"
// 표기 — 운영자가 자리표시자임을 즉시 인지하게 한다.
export const COMPANY_INFO_PLACEHOLDER: BusinessInfo = {
  company_name_ko: "(주)숨코리아",
  company_name_en: "Soom Korea Inc.",
  ceo: "출시 전 등록 예정",
  business_registration_no: "출시 전 등록 예정",
  ecommerce_registration_no: "출시 전 등록 예정",
  address_ko: "출시 전 등록 예정",
  address_en: "To be registered before launch",
  // 대표 전화 — (주)숨코리아 정식 번호 (CI/docs/legal/business-info.md 와 정합).
  phone: "02-2038-2935",
  // 이메일 도메인은 `6. CI/docs/legal/business-info.md` 정본과 일치 (dollsoom.com).
  support_email: "support@dollsoom.com",
  // PIPA 제31조 지정 DPO. Server `/api/v1/legal/business-info` 도입 시 동기화.
  privacy_officer: "이승주",
  privacy_officer_email: "privacy@dollsoom.com",
  placeholder: true,
};

/**
 * 동기 fallback — Server 도달 실패 시 사용. RSC 에서는 `getBusinessInfoServer()`
 * (server action) 을 우선 호출하고, 실패 시 본 placeholder 로 graceful degrade.
 */
export function getCompanyInfoFallback(): BusinessInfo {
  return COMPANY_INFO_PLACEHOLDER;
}
