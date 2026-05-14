import Link from "next/link";

export const dynamic = "force-dynamic";

// Audit log CSV export 페이지 (P1 §5.2 #32).
// since/until 입력 + 다운로드 버튼. 실제 CSV 응답은 sibling route handler
// (./download/route.ts) 가 streaming 으로 반환.
// 권한 게이트: /dashboard/audit prefix → SECOPS_OR_ABOVE (middleware + operatorRoles.ts).
//
// 본 페이지는 form 만 — submit 시 GET /dashboard/audit/export/download?since=&until=
// 로 navigate, 브라우저가 Content-Disposition: attachment 로 다운로드 트리거.
//
// 한 번에 최대 10,000 row (Server 측 cursor limit + admin client 제약). 더 큰 export
// 는 별도 endpoint 가 별도 PR 에서 마련될 예정 — 안내 문구로 명시.

function defaultIsoSince(): string {
  // ISO local datetime-input 포맷 (YYYY-MM-DDTHH:mm) — 기본 24시간 전.
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

function defaultIsoUntil(): string {
  return new Date().toISOString().slice(0, 16);
}

export default async function AuditExportPage() {
  return (
    <div className="page">
      <Link href="/dashboard/audit">← Audit 로그</Link>
      <h1 style={{ marginTop: 12 }}>Audit 로그 CSV Export</h1>
      <p className="muted">
        시작/종료 시각을 입력하면 audit_log 의 sequence_no, action, operator, target,
        outcome, ip, created_at, prev_hash, current_hash 컬럼을 CSV 로 내려받습니다.
      </p>
      <p className="muted" style={{ fontSize: 12 }}>
        한 번에 최대 <strong>10,000 row</strong> 까지 export. 더 큰 범위가 필요하면
        시간 구간을 좁히거나 후속 release 의 streaming export 기능을 사용하세요.
      </p>

      <form
        action="/dashboard/audit/export/download"
        method="get"
        className="card"
        style={{ maxWidth: 520, marginTop: 20 }}
      >
        <div className="form-row">
          <label htmlFor="since">since (시작)</label>
          <input
            id="since"
            name="since"
            type="datetime-local"
            defaultValue={defaultIsoSince()}
            required
          />
        </div>
        <div className="form-row">
          <label htmlFor="until">until (종료, 선택)</label>
          <input
            id="until"
            name="until"
            type="datetime-local"
            defaultValue={defaultIsoUntil()}
          />
        </div>
        <div className="form-row">
          <label htmlFor="action_filter">action 필터 (선택)</label>
          <input
            id="action_filter"
            name="action"
            type="text"
            placeholder="예: device_unpaired"
          />
        </div>
        <button className="btn" type="submit">CSV 다운로드</button>
      </form>

      <p className="muted" style={{ fontSize: 11, marginTop: 24 }}>
        본 export 는 SOC2 / ISO27001 감사 대비용. 다운로드 자체가 audit_log 에 기록되며
        (server 측 audit_log_exported action) operator_id + ip + since/until 가 남습니다.
      </p>
    </div>
  );
}
