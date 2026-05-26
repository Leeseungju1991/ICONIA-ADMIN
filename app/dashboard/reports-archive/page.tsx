import { readSession } from "@/lib/authCookie";
import { resolveIdentity } from "@/lib/identity";
import type { OperatorRole } from "@/lib/operatorRoles";
import ReportsArchiveClient from "./ReportsArchiveClient";

export const dynamic = "force-dynamic";

// 운영 리포트 아카이브 — 모든 role 조회 가능, 수동 트리거는 superadmin 만.
// role 은 server-side `/api/v1/operator/me` 서명검증 신원을 정본으로 사용하고,
// 도달 불가 시 JWT payload fallback (resolveIdentity 내부). client 컴포넌트에 주입.
export default async function ReportsArchivePage() {
  const jwt = readSession();
  const identity = await resolveIdentity(jwt);
  const role: OperatorRole = identity?.role ?? "viewer";
  return <ReportsArchiveClient role={role} />;
}
