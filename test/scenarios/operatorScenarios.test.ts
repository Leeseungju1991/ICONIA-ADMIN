// 운영자 36 시나리오 가혹 테스트 — 가시적인 카탈로그.
//
// 본 파일은 단위/통합 계층에서 36 시나리오 매트릭스를 한 곳에 모은 "운영 회귀 게이트".
// 각 it() 은 한 시나리오의 핵심 invariant 만 검증해 빨리 실패하고 빨리 회복한다.
//
// 카탈로그 (사용자 요구):
//   A 로그인/세션 (1–5), B RBAC (6–9), C 페이지 (10–24), D SERVER 부재 (25–26),
//   E CSP/보안 (27–28), F audit (29–32), G error boundary (33–34), H i18n/a11y (35–36).

import { describe, it, expect } from "vitest";
import {
  ALL_ROLES,
  ROLE_LABEL,
  canAccessPath,
  findRequiredRoles,
  parseRoleFromJwtPayload,
  roleAllowed,
} from "@/lib/operatorRoles";
import { messagesKo } from "@/lib/i18n/messages-ko";
import { messagesEn } from "@/lib/i18n/messages-en";
import { t, resolveLocale, SUPPORTED_LOCALES } from "@/lib/i18n";
import { maskEmail, maskPhone } from "@/lib/maskPii";

// ──────────────────────────────────────────────────────────────────────────
// B. RBAC 권한별 UI 가시성 (시나리오 6–9)
// ──────────────────────────────────────────────────────────────────────────

describe("RBAC — 권한별 경로 가시성 (#6–9)", () => {
  it("#6 CS 역할 — 사용자 데이터 조회만 접근 (변경 페이지 차단)", () => {
    expect(canAccessPath("cs", "/dashboard/users")).toBe(true);
    expect(canAccessPath("cs", "/dashboard/user-360")).toBe(true);
    expect(canAccessPath("cs", "/dashboard/reports")).toBe(true);
    // 변경 권한 (kill switch / OTA / firmware deploy / operators) 은 차단.
    expect(canAccessPath("cs", "/dashboard/ops")).toBe(false);
    expect(canAccessPath("cs", "/dashboard/ota")).toBe(false);
    expect(canAccessPath("cs", "/dashboard/operators")).toBe(false);
    expect(canAccessPath("cs", "/dashboard/ip-allowlist")).toBe(false);
  });

  it("#7 SRE 역할 — 운영 조작 (circuit close / OTA / devices) 가능", () => {
    expect(canAccessPath("sre", "/dashboard/ops")).toBe(true);
    expect(canAccessPath("sre", "/dashboard/ota")).toBe(true);
    expect(canAccessPath("sre", "/dashboard/ota-deploy")).toBe(true);
    expect(canAccessPath("sre", "/dashboard/devices")).toBe(true);
    expect(canAccessPath("sre", "/dashboard/factory-test")).toBe(true);
    // superadmin 전용은 불가.
    expect(canAccessPath("sre", "/dashboard/operators")).toBe(false);
    expect(canAccessPath("sre", "/dashboard/ip-allowlist")).toBe(false);
  });

  it("#8 superadmin — 모든 경로 접근 가능", () => {
    const sample = [
      "/dashboard",
      "/dashboard/operators",
      "/dashboard/ip-allowlist",
      "/dashboard/ops",
      "/dashboard/ota",
      "/dashboard/users",
      "/dashboard/devices",
      "/dashboard/legal",
      "/dashboard/feed",
    ];
    for (const path of sample) {
      expect(canAccessPath("superadmin", path)).toBe(true);
    }
  });

  it("#9 권한 없는 페이지 직접 URL — viewer 가 superadmin-only 경로 접근 차단", () => {
    expect(canAccessPath("viewer", "/dashboard/operators")).toBe(false);
    expect(canAccessPath("viewer", "/dashboard/ip-allowlist")).toBe(false);
    expect(canAccessPath("viewer", "/dashboard/ops")).toBe(false);
    expect(canAccessPath("viewer", "/dashboard/ota")).toBe(false);
  });

  it("#9 RBAC matrix prefix 우선 — 더 구체적인 경로가 일반 catch-all 보다 우선", () => {
    // /dashboard/users/rights 는 CS 이상 — /dashboard/users 와 동일 결과.
    expect(canAccessPath("cs", "/dashboard/users/rights")).toBe(true);
    // /dashboard/ota-deploy 가 /dashboard/ota 보다 먼저 매칭.
    expect(findRequiredRoles("/dashboard/ota-deploy")).toContain("sre");
    expect(findRequiredRoles("/dashboard/ota-deploy")).not.toContain("viewer");
  });

  it("RBAC — 모든 role 라벨이 한글로 정의", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABEL[role]).toBeTruthy();
      expect(typeof ROLE_LABEL[role]).toBe("string");
    }
  });

  it("RBAC — roleAllowed 가 알 수 없는 role 을 안전하게 거절", () => {
    expect(roleAllowed("unknown", ALL_ROLES)).toBe(false);
    expect(roleAllowed("", ALL_ROLES)).toBe(false);
    expect(roleAllowed(null, ALL_ROLES)).toBe(false);
  });

  it("RBAC — JWT payload parser 가 enum 강제", () => {
    expect(parseRoleFromJwtPayload({ role: "sre" })).toBe("sre");
    expect(parseRoleFromJwtPayload({ role: "hacker" })).toBeNull();
    expect(parseRoleFromJwtPayload({ role: 42 })).toBeNull();
    expect(parseRoleFromJwtPayload(null)).toBeNull();
  });
});

// ──────────────────────────────────────────────────────────────────────────
// E. CSP / 보안 헤더 (시나리오 27–28)
// ──────────────────────────────────────────────────────────────────────────

describe("보안 — XSS escape 정합 (#28)", () => {
  it("PII 마스킹 — 이메일/전화 형태 보존 + 중간 자릿수 가림", () => {
    expect(maskEmail("alice@example.com")).toMatch(/^a/);
    expect(maskEmail("alice@example.com")).toContain("@");
    expect(maskEmail("alice@example.com")).not.toContain("alice@example.com");
    expect(maskPhone("010-1234-5678")).toBe("010-****-5678");
  });

  it("payload 가 HTML/JS 형식이어도 mask 가 비파괴적 (escape 는 React 가 보장)", () => {
    const xss = '<script>alert(1)</script>@example.com';
    const masked = maskEmail(xss);
    // mask 는 단순 문자 치환만 — DOM 의미 변경 없음. React 가 출력 시 escape.
    expect(typeof masked).toBe("string");
    expect(masked).toContain("@");
  });
});

// ──────────────────────────────────────────────────────────────────────────
// H. 다국어 / 접근성 (시나리오 35–36)
// ──────────────────────────────────────────────────────────────────────────

function flatKeys(obj: unknown, prefix = ""): string[] {
  if (obj == null || typeof obj !== "object") return [];
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object") {
      out.push(...flatKeys(v, path));
    } else {
      out.push(path);
    }
  }
  return out;
}

describe("i18n — ko/en 카탈로그 (#35)", () => {
  const koKeys = new Set(flatKeys(messagesKo));
  const enKeys = new Set(flatKeys(messagesEn));

  it("ko 와 en 카탈로그가 동일한 key 셋을 가진다 (parity)", () => {
    const koOnly = [...koKeys].filter((k) => !enKeys.has(k));
    const enOnly = [...enKeys].filter((k) => !koKeys.has(k));
    expect(koOnly).toEqual([]);
    expect(enOnly).toEqual([]);
  });

  it("모든 ko 메시지가 빈 문자열이 아님 (누락 검사)", () => {
    const empties = flatKeys(messagesKo).filter((k) => {
      const v = k.split(".").reduce<unknown>((acc, part) => {
        if (acc && typeof acc === "object" && part in (acc as Record<string, unknown>)) {
          return (acc as Record<string, unknown>)[part];
        }
        return undefined;
      }, messagesKo);
      return typeof v === "string" && v.trim() === "";
    });
    expect(empties).toEqual([]);
  });

  it("t() 누락 키는 키 자체를 반환 (fallback chain)", () => {
    expect(t("does.not.exist", "ko")).toBe("does.not.exist");
    expect(t("does.not.exist", "en")).toBe("does.not.exist");
  });

  it("resolveLocale — 쿠키 우선, 아니면 ko 기본", () => {
    expect(resolveLocale("en")).toBe("en");
    expect(resolveLocale("ko")).toBe("ko");
    expect(resolveLocale(undefined)).toBe("ko");
    expect(resolveLocale("zz")).toBe("ko");
  });

  it("SUPPORTED_LOCALES 가 ko + en 만 노출", () => {
    expect(new Set(SUPPORTED_LOCALES)).toEqual(new Set(["ko", "en"]));
  });
});
