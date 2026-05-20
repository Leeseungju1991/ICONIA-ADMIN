import { listOperatorsAction } from "@/lib/actions/operators";
import { readSession } from "@/lib/authCookie";
import { resolveIdentity } from "@/lib/identity";
import OperatorsClient from "./OperatorsClient";

export const dynamic = "force-dynamic";

// 운영자 관리 — superadmin 전용 (middleware PATH_REQUIRED_ROLES 가 1차 차단).
// 서버 컴포넌트에서 운영자 목록을 조회해 client 컴포넌트에 주입한다.
// Server 라우트 `GET /api/v1/operator/admin/operators` 와 정합 — 실 연동.
export default async function OperatorsPage() {
  const result = await listOperatorsAction();

  // 현재 로그인한 운영자 식별 — self-disable UI 가드 + audit 표시용.
  // Server `/api/v1/operator/me` 서명검증 신원 우선, 도달 불가 시 JWT fallback.
  const jwt = readSession();
  const identity = await resolveIdentity(jwt);

  return (
    <OperatorsClient
      initial={result}
      currentOperatorId={identity?.id ?? null}
      currentOperatorEmail={identity?.email ?? null}
    />
  );
}
