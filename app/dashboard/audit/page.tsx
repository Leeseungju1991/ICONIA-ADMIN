import AuditClient from "./AuditClient";

// 2026-06-01 — AuditLog 통합 뷰어 (secops/sre/superadmin).
// Server: GET /api/v1/admin/audit-log. middleware + PATH_REQUIRED_ROLES 가 1차 차단.
// /dashboard/ops/audit 와 별도 path — secops 가 운영 안정성 콘솔(ops/) 전체에
// 접근하지 못해도 본 path 단독으로 audit 만 조회할 수 있게 분리.
export const dynamic = "force-dynamic";

export default function AuditPage() {
  return <AuditClient />;
}
