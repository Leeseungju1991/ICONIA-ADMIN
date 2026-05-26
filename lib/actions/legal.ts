"use server";

// 약관/공지/사용자 권리 server actions — (주)숨코리아 출시 정비.
//
// 정책:
//   - 활성 버전 조회 / 본문 목록 조회는 모든 운영자 (서버가 RBAC 가드).
//   - 신버전 발행은 superadmin 전용 — 서버도 동일 가드. UI 는 메뉴 자체 숨김 + 폼 비활성.
//   - 동의 통계는 모든 운영자 — 운영 가시성.
//   - Server endpoint 미구현 환경에서는 ERR_NETWORK / ERR_NOT_FOUND 가
//     ServerResult.error 로 graceful 매핑되어 페이지가 mock fallback 으로 표시.

import { readSession } from "@/lib/authCookie";
import {
  getActiveTermsVersions,
  listTermsVersions,
  publishTermsVersion,
  getConsentStats,
  getBusinessInfo,
  type ActiveTermsVersions,
  type ConsentStats,
  type TermsKind,
  type TermsVersionRow,
  type BusinessInfoDto,
} from "@/lib/adminApi";
import { COMPANY_INFO_PLACEHOLDER, type BusinessInfo } from "@/lib/companyInfo";

export type LegalActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

/** 운영자가 보는 활성 약관 버전. */
export async function getActiveTermsAction(): Promise<LegalActionResult<ActiveTermsVersions>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await getActiveTermsVersions({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

/**
 * 약관 4종 모든 버전 — Server 미구현 시 fallback mock 4행 (각 kind 의 가상의 active v1.0).
 * 운영자 콘솔이 "데이터 없음" 으로만 노출되지 않도록 placeholder + DEMO 배너.
 */
export async function listTermsAction(args?: {
  kind?: TermsKind;
}): Promise<LegalActionResult<{ items: TermsVersionRow[]; placeholder: boolean }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listTermsVersions({ jwt, kind: args?.kind });
  if (res.ok) {
    return { ok: true, data: { items: res.data.items, placeholder: false } };
  }
  // graceful fallback: Server endpoint 미구현 — placeholder 4행.
  // 운영 의사결정 금지: 페이지 상단에 DEMO 배너가 함께 표시되어야 한다.
  if (res.code === "ERR_NETWORK" || res.code === "ERR_INVALID_RESPONSE" || res.status === 404) {
    const items: TermsVersionRow[] = buildPlaceholderTermsRows(args?.kind);
    return { ok: true, data: { items, placeholder: true } };
  }
  return { ok: false, message: res.message, code: res.code };
}

/** 신버전 발행 — superadmin 전용. server 측이 권한 가드. */
export async function publishTermsAction(args: {
  kind: TermsKind;
  version: string;
  body_ko: string;
  body_en?: string;
  change_note: string;
  activate: boolean;
}): Promise<LegalActionResult<TermsVersionRow>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.version || args.version.trim().length < 1) {
    return { ok: false, message: "버전을 입력하세요." };
  }
  if (!args.body_ko || args.body_ko.trim().length < 20) {
    return { ok: false, message: "한국어 본문은 20자 이상 입력하세요." };
  }
  if (!args.change_note || args.change_note.trim().length < 5) {
    return { ok: false, message: "변경 사유는 5자 이상 입력하세요." };
  }
  const res = await publishTermsVersion({
    jwt,
    kind: args.kind,
    version: args.version.trim(),
    body_ko: args.body_ko,
    body_en: args.body_en,
    change_note: args.change_note.trim(),
    activate: args.activate,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

/** 동의 통계 — Server 미구현 시 placeholder. */
export async function getConsentStatsAction(args?: {
  days?: number;
}): Promise<LegalActionResult<{ stats: ConsentStats; placeholder: boolean }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await getConsentStats({ jwt, days: args?.days ?? 30 });
  if (res.ok) {
    return { ok: true, data: { stats: res.data, placeholder: false } };
  }
  if (res.code === "ERR_NETWORK" || res.code === "ERR_INVALID_RESPONSE" || res.status === 404) {
    return { ok: true, data: { stats: buildPlaceholderConsentStats(args?.days ?? 30), placeholder: true } };
  }
  return { ok: false, message: res.message, code: res.code };
}

/** 운영자가 보는 회사 정보 — Server `/api/v1/legal/business-info` 미구현 시 placeholder. */
export async function getBusinessInfoAction(): Promise<LegalActionResult<BusinessInfo>> {
  const jwt = readSession();
  // 세션 없어도 placeholder 는 항상 반환 (Sidebar footer 가 anonymous 렌더 시).
  if (!jwt) return { ok: true, data: COMPANY_INFO_PLACEHOLDER };
  const res = await getBusinessInfo({ jwt });
  if (res.ok) {
    const d: BusinessInfoDto = res.data;
    return {
      ok: true,
      data: { ...d, placeholder: false },
    };
  }
  return { ok: true, data: COMPANY_INFO_PLACEHOLDER };
}

// ────────────────── Placeholder builders ──────────────────
// Server endpoint 미구현 환경에서 화면이 비지 않도록 안전한 placeholder 데이터를 생성.
// 모든 페이지는 placeholder=true 일 때 DEMO 배너로 사용자에게 명시.

function buildPlaceholderTermsRows(filterKind?: TermsKind): TermsVersionRow[] {
  const now = new Date().toISOString();
  const rows: TermsVersionRow[] = [
    {
      kind: "terms",
      version: "v1.0",
      body_ko: PLACEHOLDER_BODY_KO("서비스 이용약관"),
      body_en: PLACEHOLDER_BODY_EN("Service Terms of Use"),
      body_hash: null,
      is_active: true,
      effective_from: now,
      effective_to: null,
      published_by: null,
      change_note: "초기 발행 (placeholder).",
    },
    {
      kind: "privacy",
      version: "v1.0",
      body_ko: PLACEHOLDER_BODY_KO("개인정보 처리방침"),
      body_en: PLACEHOLDER_BODY_EN("Privacy Policy"),
      body_hash: null,
      is_active: true,
      effective_from: now,
      effective_to: null,
      published_by: null,
      change_note: "초기 발행 (placeholder).",
    },
    {
      kind: "marketing",
      version: "v1.0",
      body_ko: PLACEHOLDER_BODY_KO("마케팅 정보 수신 동의"),
      body_en: PLACEHOLDER_BODY_EN("Marketing Communications Consent"),
      body_hash: null,
      is_active: true,
      effective_from: now,
      effective_to: null,
      published_by: null,
      change_note: "초기 발행 (placeholder).",
    },
    {
      kind: "third_party",
      version: "v1.0",
      body_ko: PLACEHOLDER_BODY_KO("제3자 정보 제공 동의 (Google Gemini)"),
      body_en: PLACEHOLDER_BODY_EN("Third-Party Data Sharing Consent (Google Gemini)"),
      body_hash: null,
      is_active: true,
      effective_from: now,
      effective_to: null,
      published_by: null,
      change_note: "초기 발행 (placeholder).",
    },
  ];
  return filterKind ? rows.filter((r) => r.kind === filterKind) : rows;
}

function PLACEHOLDER_BODY_KO(title: string): string {
  return [
    `# ${title}`,
    "",
    "본 문서는 출시 전 placeholder 본문입니다. 법무 검토 후 실제 내용으로 교체 예정입니다.",
    "",
    "## 제1조 (목적)",
    "본 약관은 (주)숨코리아 (이하 \"회사\") 가 제공하는 ICONIA 서비스의 이용과 관련하여",
    "회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.",
    "",
    "## 제2조 (정의)",
    "회사가 제공하는 서비스는 음성·텍스트 기반 AI 대화 인형 (ICONIA) 및 부가 서비스를 의미합니다.",
    "",
    "## 제3조 (개인정보보호)",
    "회사는 「개인정보 보호법」 등 관계 법령이 정하는 바에 따라 이용자의 개인정보 보호를 위해 노력합니다.",
    "",
    "TODO: 출시 전 법무팀 검토 본문으로 교체.",
  ].join("\n");
}

function PLACEHOLDER_BODY_EN(title: string): string {
  return [
    `# ${title}`,
    "",
    "This document is a pre-launch placeholder. It will be replaced after legal review.",
    "",
    "## Article 1 (Purpose)",
    "These terms govern the use of the ICONIA service provided by Soom Korea Inc.",
    "",
    "TODO: replace with reviewed final wording before launch.",
  ].join("\n");
}

function buildPlaceholderConsentStats(days: number): ConsentStats {
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  return {
    range_start: start.toISOString(),
    range_end: now.toISOString(),
    by_kind: {
      terms: [
        { version: "v1.0", granted: 1284, revoked: 0, is_active: true },
      ],
      privacy: [
        { version: "v1.0", granted: 1284, revoked: 0, is_active: true },
      ],
      marketing: [
        { version: "v1.0", granted: 612, revoked: 47, is_active: true },
      ],
      third_party: [
        { version: "v1.0", granted: 1281, revoked: 3, is_active: true },
      ],
    },
    marketing_opt_in_rate: 0.479,
    total_consent_events: 4474,
  };
}
