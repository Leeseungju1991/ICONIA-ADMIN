import { readSession } from "@/lib/authCookie";
import { readIdentityFromJwt } from "@/lib/identity";
import { listOperators, type OperatorRow } from "@/lib/adminApi";
import { disableOperatorAction } from "@/lib/actions/operators";
import { ConfirmActionForm } from "@/app/components/ConfirmActionForm";
import { DisabledActionButton } from "@/app/components/DisabledActionButton";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

export default async function OperatorsPage() {
  const jwt = readSession()!;
  const identity = readIdentityFromJwt(jwt);
  // viewer 분기 — operators 페이지는 SUPERADMIN_ONLY (middleware) 이므로 viewer 도달은
  // 실제로는 차단되지만, 일관된 mutation gating 패턴 유지를 위해 명시 (P2 round).
  const canMutate = identity?.role !== "viewer";
  const res = await listOperators({ jwt });

  // self-disable 차단 — 현재 운영자가 본인 계정을 비활성화하는 시도를 UI 단에서 막음
  // (P0 §5.1.10b / 감사 §2.14). id (JWT sub) 우선, fallback 으로 email 비교.
  function isSelf(op: OperatorRow): boolean {
    if (!identity) return false;
    if (identity.id && op.id === identity.id) return true;
    if (identity.email && op.email && op.email.toLowerCase() === identity.email.toLowerCase()) {
      return true;
    }
    return false;
  }

  return (
    <div className="page">
      <h1>운영자</h1>
      <p className="muted">쓰택 / SecOps / SRE / Superadmin 계정. TOTP 등록 여부, 마지막 로그인, 비활성화 상태. 비활성화는 이중 확인 + 사유 필수 (audit 동반).</p>

      {!res.ok ? (
        <div className="error" role="alert">{messageForCode(res.code, res.message)}</div>
      ) : res.data.operators.length === 0 ? (
        <div className="empty">등록된 운영자 없음</div>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th>email</th><th>role</th><th>TOTP</th><th>last_login</th><th>created</th><th>status</th><th></th>
            </tr>
          </thead>
          <tbody>
            {res.data.operators.map((op: OperatorRow) => (
              <tr key={op.id}>
                <td>{op.email}</td>
                <td><span className="badge muted">{op.role}</span></td>
                <td>{op.totp_enrolled ? <span className="badge ok">설정됨</span> : <span className="badge warn">미설정</span>}</td>
                <td>{op.last_login_at ? new Date(op.last_login_at).toLocaleString("ko-KR") : "—"}</td>
                <td>{new Date(op.created_at).toLocaleDateString("ko-KR")}</td>
                <td>{op.disabled_at ? <span className="badge err">비활성화</span> : <span className="badge ok">활성</span>}</td>
                <td className="cell-actions">
                  {!op.disabled_at && (
                    isSelf(op) ? (
                      <button
                        type="button"
                        className="btn small danger"
                        disabled
                        title="본인 계정은 비활성화할 수 없습니다"
                        aria-label="본인 계정은 비활성화할 수 없습니다"
                        data-testid="self-disable-blocked"
                      >
                        비활성화 (본인)
                      </button>
                    ) : canMutate ? (
                      <ConfirmActionForm
                        action={disableOperatorAction}
                        hidden={{ operator_id: op.id }}
                        confirmMessage={`운영자 ${op.email} 를 비활성화하시겠어요?\n\n이 운영자는 즉시 로그아웃되며 다시 로그인할 수 없습니다.`}
                        reasonRequired
                        buttonLabel="비활성화"
                        buttonClassName="btn small danger"
                      />
                    ) : (
                      <DisabledActionButton buttonLabel="비활성화" buttonClassName="btn small danger" />
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 16 }}>
        새 운영자 추가 / 역할 변경은 SRE 자체 CLI(`scripts/operator/...`) 로만 가능하도록 서버단 정책.
      </p>
    </div>
  );
}
