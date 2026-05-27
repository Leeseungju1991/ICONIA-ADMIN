import { describe, it, expect } from "vitest";
import {
  ALL_ROLES,
  ROLE_LABEL,
  canAccessPath,
  findRequiredRoles,
  parseRoleFromJwtPayload,
  roleAllowed,
} from "./operatorRoles";

describe("operatorRoles — findRequiredRoles", () => {
  it("운영자 관리는 superadmin 전용", () => {
    expect(findRequiredRoles("/dashboard/operators")).toEqual(["superadmin"]);
  });

  it("디바이스는 secops 이상", () => {
    expect(findRequiredRoles("/dashboard/devices")).toEqual([
      "superadmin",
      "sre",
      "secops",
    ]);
  });

  it("사용자/신고는 cs 이상", () => {
    expect(findRequiredRoles("/dashboard/users")).toContain("cs");
    expect(findRequiredRoles("/dashboard/reports")).toContain("cs");
  });

  it("대시보드 홈은 모든 역할", () => {
    expect(findRequiredRoles("/dashboard")).toEqual(ALL_ROLES);
  });

  it("하위 경로도 prefix 매칭", () => {
    expect(findRequiredRoles("/dashboard/ota/detail")).toEqual([
      "superadmin",
      "sre",
      "secops",
    ]);
  });

  it("매트릭스 밖 경로는 null", () => {
    expect(findRequiredRoles("/login")).toBeNull();
  });

  it("더 구체적인 prefix 가 우선 (ops 가 dashboard 보다 먼저)", () => {
    // /dashboard/ops 는 SRE_OR_ABOVE 여야 함 — /dashboard (ALL_ROLES) 가 아님.
    expect(findRequiredRoles("/dashboard/ops")).not.toEqual(ALL_ROLES);
  });
});

describe("operatorRoles — roleAllowed", () => {
  it("허용 목록에 있으면 true", () => {
    expect(roleAllowed("sre", ["superadmin", "sre"])).toBe(true);
  });

  it("허용 목록에 없으면 false", () => {
    expect(roleAllowed("viewer", ["superadmin", "sre"])).toBe(false);
  });

  it("null/undefined role 은 항상 false", () => {
    expect(roleAllowed(null, ALL_ROLES)).toBe(false);
    expect(roleAllowed(undefined, ALL_ROLES)).toBe(false);
  });
});

describe("operatorRoles — canAccessPath", () => {
  it("viewer 는 운영자 관리 접근 불가", () => {
    expect(canAccessPath("viewer", "/dashboard/operators")).toBe(false);
  });

  it("superadmin 은 모든 경로 접근 가능", () => {
    expect(canAccessPath("superadmin", "/dashboard/operators")).toBe(true);
    expect(canAccessPath("superadmin", "/dashboard/ops")).toBe(true);
    expect(canAccessPath("superadmin", "/dashboard/users")).toBe(true);
  });

  it("cs 는 사용자/신고 접근 가능, OTA/디바이스는 불가", () => {
    expect(canAccessPath("cs", "/dashboard/users")).toBe(true);
    expect(canAccessPath("cs", "/dashboard/reports")).toBe(true);
    expect(canAccessPath("cs", "/dashboard/ota")).toBe(false);
    expect(canAccessPath("cs", "/dashboard/devices")).toBe(false);
  });

  it("모든 역할은 대시보드 홈 + 에러 모니터링 접근 가능", () => {
    for (const role of ALL_ROLES) {
      expect(canAccessPath(role, "/dashboard")).toBe(true);
      expect(canAccessPath(role, "/dashboard/server-errors")).toBe(true);
      expect(canAccessPath(role, "/dashboard/stats")).toBe(true);
    }
  });

  it("매트릭스에 없는 경로는 접근 허용 (보수적 차단은 매트릭스 명시)", () => {
    expect(canAccessPath("viewer", "/login")).toBe(true);
  });

  it("viewer 는 user-360 통합 조회 접근 가능", () => {
    expect(canAccessPath("viewer", "/dashboard/user-360")).toBe(true);
  });

  it("viewer 는 community 모더레이션 접근 가능", () => {
    expect(canAccessPath("viewer", "/dashboard/community")).toBe(true);
  });

  it("비유효 /dashboard 하위 경로는 catch-all 로 ALL_ROLES 적용 (matrix 기본 동작)", () => {
    // /dashboard 하위 미정의 경로는 마지막 /dashboard catch-all (ALL_ROLES) 에 잡힘.
    expect(findRequiredRoles("/dashboard/non-existent")).toEqual(ALL_ROLES);
    expect(canAccessPath("viewer", "/dashboard/non-existent")).toBe(true);
  });
});

describe("operatorRoles — parseRoleFromJwtPayload", () => {
  it("유효한 role 클레임 파싱", () => {
    expect(parseRoleFromJwtPayload({ role: "sre" })).toBe("sre");
  });

  it("알 수 없는 role 은 null", () => {
    expect(parseRoleFromJwtPayload({ role: "hacker" })).toBeNull();
  });

  it("role 클레임 없으면 null", () => {
    expect(parseRoleFromJwtPayload({})).toBeNull();
    expect(parseRoleFromJwtPayload(null)).toBeNull();
  });
});

describe("operatorRoles — ROLE_LABEL", () => {
  it("모든 역할에 한글 라벨 존재", () => {
    for (const role of ALL_ROLES) {
      expect(ROLE_LABEL[role]).toBeTruthy();
    }
  });
});
