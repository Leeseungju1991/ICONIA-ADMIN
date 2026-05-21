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
/** CS 가 사용자/신고 처리. secops/sre/superadmin 은 상위 권한이므로 포함. */
export const CS_OR_ABOVE: OperatorRole[] = ["superadmin", "sre", "secops", "cs"];

/** 운영자 역할 한글 표시 라벨 — 헤더 배지 / 운영자 관리 화면용. */
export const ROLE_LABEL: Record<OperatorRole, string> = {
  superadmin: "최고관리자",
  sre: "SRE",
  secops: "보안운영",
  cs: "고객지원",
  viewer: "읽기전용",
};

/**
 * 경로 접근 권한 매트릭스. 서버 권한 증명 이외 애초 접근 차단 (defense in depth).
 * 더 구체적인 prefix 가 먼저 와야 한다 (findRequiredRoles 는 첫 매칭 사용).
 */
export const PATH_REQUIRED_ROLES: { prefix: string; roles: OperatorRole[] }[] = [
  // superadmin 전용 — 운영자 관리.
  { prefix: "/dashboard/operators", roles: SUPERADMIN_ONLY },
  // sre/secops/superadmin — 운영 안정성 콘솔 (kill switch / recovery / replay).
  { prefix: "/dashboard/ops", roles: SRE_OR_ABOVE },
  // sre/secops/superadmin — OTA 배포 / 펌웨어.
  { prefix: "/dashboard/ota", roles: SRE_OR_ABOVE },
  { prefix: "/dashboard/personas", roles: SRE_OR_ABOVE },
  // sre/secops/superadmin — 양산 LOT/시리얼/출고 테스트 (#14, #15).
  { prefix: "/dashboard/factory-test", roles: SRE_OR_ABOVE },
  // secops/sre/superadmin — Fleet 출하 잠금 invariant (V3.0 #27 Phase 12 #8).
  { prefix: "/dashboard/boot-invariants", roles: SECOPS_OR_ABOVE },
  // CS 이상 — AS 접수/조회 (replace/close 는 server 가 SRE 이상으로 분기).
  { prefix: "/dashboard/as", roles: CS_OR_ABOVE },
  // 모든 운영자 — 운영 리포트 조회 (수동 트리거는 server 가 SUPERADMIN_ONLY).
  { prefix: "/dashboard/reports-archive", roles: ALL_ROLES },
  // secops/sre/superadmin — 디바이스 unpair 등 파괴적 액션.
  { prefix: "/dashboard/devices", roles: SECOPS_OR_ABOVE },
  // cs 이상 — 사용자 / 신고 처리.
  { prefix: "/dashboard/users", roles: CS_OR_ABOVE },
  { prefix: "/dashboard/reports", roles: CS_OR_ABOVE },
  // CS 통합 조회 — CS 가 한 화면에서 사용자/기기/오류/조치를 보는 surface (V1.0 #7).
  { prefix: "/dashboard/cs", roles: CS_OR_ABOVE },
  // RAG / 대화 품질 — secops/sre/superadmin (AI 운영) + cs (피드백 확인) 까지 허용.
  { prefix: "/dashboard/knowledge", roles: CS_OR_ABOVE },
  // 일반 조회 (대시보드 홈, 에러 모니터링, 통계, 공지, 푸시) 는 모든 role.
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

/**
 * 주어진 경로에 현재 역할이 접근 가능한지 — Sidebar 네비게이션 게이팅용.
 * 매트릭스에 없는 경로(매칭 실패)는 접근 허용으로 간주 (보수적 차단은 매트릭스에 명시).
 */
export function canAccessPath(role: string | null | undefined, pathname: string): boolean {
  const required = findRequiredRoles(pathname);
  if (!required) return true;
  return roleAllowed(role, required);
}

export function parseRoleFromJwtPayload(payload: Record<string, unknown> | null): OperatorRole | null {
  if (!payload) return null;
  const r = payload.role;
  if (typeof r !== "string") return null;
  if ((ALL_ROLES as string[]).includes(r)) return r as OperatorRole;
  return null;
}
