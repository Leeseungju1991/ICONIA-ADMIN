// Operator role 정의 + UI 권한 분기 헬퍼.
// 서버 enum (OperatorRole) 과 일치. 서버가 정본 — admin web 은 표시/네비게이션 gating 만.
//
// 권한 위계 (높은 순서):
//   superadmin — 모든 권한. operator 생성/비활성화/역할 변경.
//   sre        — 운영 조작 (devices, firmware deploy, cohort).
//   secops     — 보안 관찰 (audit log, suspicious activity).
//   cs         — 고객서비스 (사용자 검색, 강제 로그아웃, post moderation).
//   viewer     — 읽기 전용. 대부분 list 조회만.
//
// 서버 권한 증명 은 다른 계층에서 처리 (admin web 은 이걸 신뢰하면 안 됨).
// 하지만 UX 차원에서 "접근 주신 없는 페이지 느낌" 제거 — viewer가 disable 버튼 눌리고 403
// 을 받는 대신, 애초에 링크 자체를 숨김.

export type OperatorRole = "superadmin" | "sre" | "secops" | "cs" | "viewer";

export const ALL_ROLES: OperatorRole[] = ["superadmin", "sre", "secops", "cs", "viewer"];
export const SECOPS_OR_ABOVE: OperatorRole[] = ["superadmin", "sre", "secops"];
export const SRE_OR_ABOVE: OperatorRole[] = ["superadmin", "sre", "secops"];
export const SUPERADMIN_ONLY: OperatorRole[] = ["superadmin"];

/** 경로 접근 권한 매트릭스. 서버 권한 증명 이외 애초 접근 차단 (defense in depth). */
export const PATH_REQUIRED_ROLES: { prefix: string; roles: OperatorRole[] }[] = [
  // superadmin 전용 — 운영자 관리.
  { prefix: "/dashboard/operators", roles: SUPERADMIN_ONLY },
  // secops/sre/superadmin — 사용자 강제 로그아웃 / 디바이스 unpair 등 파괴적 액션.
  { prefix: "/dashboard/devices", roles: SECOPS_OR_ABOVE },
  { prefix: "/dashboard/users", roles: ["superadmin", "sre", "secops", "cs"] },
  { prefix: "/dashboard/firmware", roles: SRE_OR_ABOVE },
  // audit log — 운영 아닌 독립 추적. secops/sre/superadmin.
  { prefix: "/dashboard/audit", roles: SECOPS_OR_ABOVE },
  // 일반 조회는 모든 role.
  { prefix: "/dashboard", roles: ALL_ROLES },
];

export function findRequiredRoles(pathname: string): OperatorRole[] | null {
  for (const entry of PATH_REQUIRED_ROLES) {
    if (pathname === entry.prefix || pathname.startsWith(entry.prefix + "/")) {
      return entry.roles;
    }
  }
  return null;
}

export function roleAllowed(role: string | null | undefined, allowed: OperatorRole[]): boolean {
  if (!role) return false;
  return (allowed as string[]).includes(role);
}

export function parseRoleFromJwtPayload(payload: Record<string, unknown> | null): OperatorRole | null {
  if (!payload) return null;
  const r = payload.role;
  if (typeof r !== "string") return null;
  if ((ALL_ROLES as string[]).includes(r)) return r as OperatorRole;
  return null;
}
