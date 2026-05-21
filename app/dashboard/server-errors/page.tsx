"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { OpsAuditTrailPanel } from "../_components/OpsAuditTrailPanel";
import { MockDataBanner } from "../_components/MockDataBanner";
import { mockServerErrors, formatDate, type ServerErrorRow } from "@/lib/mockData";
import {
  CATEGORY_LABEL,
  lookupErrorCode,
  operatorLabelForCode,
  USER_VISIBILITY_CHIP,
  USER_VISIBILITY_LABEL,
} from "@/lib/errorCatalog";
import {
  exportCsv,
  exportJson,
  isoDateStamp,
  type ExportColumn,
} from "@/lib/exportData";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";

// path/message 휴리스틱 → 카탈로그 코드.
function inferCatalogCode(row: ServerErrorRow): string {
  const msg = row.message.toLowerCase();
  if (msg.includes("pg connection pool")) return "PG_POOL_EXHAUSTED";
  if (msg.includes("gemini api gateway timeout")) return "GEMINI_GATEWAY_TIMEOUT";
  if (msg.includes("rate limit")) return "GEMINI_RATE_LIMITED";
  if (msg.includes("bad gateway")) return "WOO_BAD_GATEWAY";
  if (msg.includes("efs mount")) return "EFS_MOUNT_LAG";
  return row.status_code >= 500 ? "ERR_SERVER_UNAVAILABLE" : "ERR_INTERNAL";
}

function statusChip(code: number): string {
  if (code >= 500) return "chip chip-error";
  if (code >= 400) return "chip chip-warn";
  return "chip chip-info";
}

const exportColumns: ExportColumn<ServerErrorRow>[] = [
  { key: "id", header: "id", value: (r) => r.id },
  { key: "service", header: "service", value: (r) => r.service },
  { key: "status_code", header: "status_code", value: (r) => r.status_code },
  { key: "path", header: "path", value: (r) => r.path },
  { key: "catalog_code", header: "catalog_code", value: (r) => inferCatalogCode(r) },
  { key: "operator_label", header: "operator_label", value: (r) => operatorLabelForCode(inferCatalogCode(r)) },
  { key: "category", header: "category", value: (r) => lookupErrorCode(inferCatalogCode(r)).category },
  { key: "user_visibility", header: "user_visibility", value: (r) => lookupErrorCode(inferCatalogCode(r)).userVisibility },
  { key: "message", header: "message", value: (r) => r.message },
  { key: "count", header: "count", value: (r) => r.count },
  { key: "first_seen", header: "first_seen", value: (r) => r.first_seen },
  { key: "last_seen", header: "last_seen", value: (r) => r.last_seen },
];

export default function ServerErrorsPage() {
  const [service, setService] = useState<"all" | ServerErrorRow["service"]>("all");
  const [statusBand, setStatusBand] = useState<"all" | "4xx" | "5xx">("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<ServerErrorRow | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      mockServerErrors.filter((e) => {
        if (service !== "all" && e.service !== service) return false;
        if (statusBand === "4xx" && !(e.status_code >= 400 && e.status_code < 500)) return false;
        if (statusBand === "5xx" && !(e.status_code >= 500)) return false;
        if (q) {
          const s = q.toLowerCase();
          const label = operatorLabelForCode(inferCatalogCode(e)).toLowerCase();
          if (
            !e.path.toLowerCase().includes(s) &&
            !e.message.toLowerCase().includes(s) &&
            !e.service.toLowerCase().includes(s) &&
            !label.includes(s)
          ) {
            return false;
          }
        }
        return true;
      }),
    [service, statusBand, q],
  );

  const stats = useMemo(() => {
    const total = mockServerErrors.reduce((s, e) => s + e.count, 0);
    const fivexx = mockServerErrors.filter((e) => e.status_code >= 500).reduce((s, e) => s + e.count, 0);
    const fourxx = mockServerErrors.filter((e) => e.status_code >= 400 && e.status_code < 500).reduce((s, e) => s + e.count, 0);
    const services = new Set(mockServerErrors.map((e) => e.service)).size;
    return { total, fivexx, fourxx, services };
  }, []);

  async function runAction(row: ServerErrorRow, kind: "retry_request" | "open_runbook") {
    if (kind === "open_runbook") {
      window.open("https://github.com/Leeseungju1991/ICONIA-ADMIN/blob/main/docs/runbooks.md", "_blank", "noopener");
      return;
    }
    const code = inferCatalogCode(row);
    const entry = lookupErrorCode(code);
    if (!entry.retryable) {
      setToast(`${code} 는 자동 재시도 불가 코드입니다. 런북 참조.`);
      return;
    }
    const reason = window.prompt("재처리 요청 사유 (5자 이상, 감사 로그에 기록).");
    if (!reason || reason.trim().length < 5) {
      setToast("사유가 5자 이상 필요합니다.");
      return;
    }
    // 운영자 액션이므로 일시 실패는 silent retry.
    const result = await recordOpsAuditWithSilentRetry({
      action: "server.retry",
      target_label: `${row.service} ${row.status_code} ${row.path}`,
      target_id: row.id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "queued",
    });
    setAuditTick((t) => t + 1);
    if (result.ok) {
      setToast(`${row.service} 요청 재처리를 큐에 기록했습니다.`);
    } else {
      setToast(`${row.service} 재처리 큐 적재 최종 실패 — 운영자 확인 필요. [${result.attempts}회 시도]`);
    }
  }

  const columns: Column<ServerErrorRow>[] = [
    { key: "code", header: "상태", render: (r) => <span className={statusChip(r.status_code)}>{r.status_code}</span> },
    { key: "service", header: "서비스", render: (r) => <span className="chip chip-muted">{r.service}</span> },
    { key: "path", header: "경로", render: (r) => <span className="font-mono text-xs text-slate-700">{r.path}</span> },
    {
      key: "label",
      header: "운영자 라벨",
      render: (r) => {
        const entry = lookupErrorCode(inferCatalogCode(r));
        return (
          <span className="text-xs text-slate-700">
            {entry.label}
            <span className="ml-1 text-muted">· {CATEGORY_LABEL[entry.category]}</span>
          </span>
        );
      },
    },
    { key: "msg", header: "메시지", render: (r) => <span className="text-slate-700 line-clamp-1 max-w-[300px] inline-block align-middle">{r.message}</span> },
    {
      key: "uv",
      header: "사용자 인지",
      render: (r) => {
        const v = lookupErrorCode(inferCatalogCode(r)).userVisibility;
        return (
          <span className={USER_VISIBILITY_CHIP[v]} title={USER_VISIBILITY_LABEL[v]}>
            {USER_VISIBILITY_LABEL[v]}
          </span>
        );
      },
    },
    { key: "count", header: "발생", align: "right", render: (r) => r.count.toLocaleString() },
    { key: "last", header: "최근", render: (r) => <span className="text-xs text-muted">{formatDate(r.last_seen)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button className="btn-outline text-xs" type="button" onClick={() => setPicked(r)}>
          상세
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <MockDataBanner
        reason="Server 측 server_errors 수집 endpoint 미구현 — 운영 에러 로그는 CloudWatch + Sentry 가 정본. 본 화면은 운영자 점검 UI 검증 데모."
        endpoint="/api/v1/admin/errors/server (TBD)"
      />
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="총 에러 (24h)" value={stats.total.toLocaleString()} hint="모든 서비스" accent="orange" />
        <StatCard label="5xx" value={stats.fivexx.toLocaleString()} delta="서버 측" deltaTone="down" accent="pink" />
        <StatCard label="4xx" value={stats.fourxx.toLocaleString()} delta="요청 측" deltaTone="flat" accent="blue" />
        <StatCard label="영향 서비스" value={String(stats.services)} hint="서비스 종류" accent="teal" />
      </section>

      <PanelCard
        title="AWS 백엔드 에러 로그"
        description="EC2/AI worker/Persona/Webhook 등에서 발생한 5xx/4xx. 메시지 휴리스틱으로 카탈로그 코드를 매칭."
        actions={
          <>
            <input
              className="input max-w-[240px]"
              placeholder="경로·메시지·서비스 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="select max-w-[180px]"
              value={service}
              onChange={(e) => setService(e.target.value as typeof service)}
            >
              <option value="all">전체 서비스</option>
              <option value="express-api">express-api</option>
              <option value="ai-worker">ai-worker</option>
              <option value="persona">persona</option>
              <option value="billing-webhook">billing-webhook</option>
            </select>
            <select
              className="select max-w-[120px]"
              value={statusBand}
              onChange={(e) => setStatusBand(e.target.value as typeof statusBand)}
            >
              <option value="all">전체</option>
              <option value="5xx">5xx</option>
              <option value="4xx">4xx</option>
            </select>
            <button
              className="btn-outline text-sm"
              type="button"
              onClick={() => exportCsv(exportColumns, filtered, `server-errors-${isoDateStamp()}.csv`)}
            >
              CSV
            </button>
            <button
              className="btn-outline text-sm"
              type="button"
              onClick={() => exportJson(exportColumns, filtered, `server-errors-${isoDateStamp()}.json`)}
            >
              JSON
            </button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="해당 조건의 서버 에러가 없습니다." />
      </PanelCard>

      <PanelCard title="서비스 상태" description="현재 운영 중인 백엔드 서비스 헬스 (mock)">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: "express-api", state: "정상", chip: "chip chip-success", note: "p95 134ms" },
            { name: "ai-worker", state: "주의", chip: "chip chip-warn", note: "p95 4.2s" },
            { name: "persona", state: "주의", chip: "chip chip-warn", note: "429 이슈" },
            { name: "billing-webhook", state: "정상", chip: "chip chip-success", note: "큐 0건" },
          ].map((s) => (
            <div key={s.name} className="rounded-2xl bg-white/55 border border-white/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-slate-800">{s.name}</span>
                <span className={s.chip}>{s.state}</span>
              </div>
              <p className="text-[11px] text-muted mt-2">{s.note}</p>
            </div>
          ))}
        </div>
      </PanelCard>

      <OpsAuditTrailPanel
        prefix="server."
        title="서버 운영자 액션 audit (세션)"
        description="요청 재처리·런북 호출 기록. 백엔드 연동 후 Server audit_log 와 머지."
        refresh={{ tick: auditTick }}
      />

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card">
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">
            닫기
          </button>
        </div>
      ) : null}

      {picked ? (
        <ServerDrawer
          err={picked}
          onClose={() => setPicked(null)}
          onAction={(kind) => runAction(picked, kind)}
        />
      ) : null}
    </div>
  );
}

function ServerDrawer({
  err,
  onClose,
  onAction,
}: {
  err: ServerErrorRow;
  onClose: () => void;
  onAction: (kind: "retry_request" | "open_runbook") => void;
}) {
  const code = inferCatalogCode(err);
  const entry = lookupErrorCode(code);
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/30">
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 relative">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">{entry.label}</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{code}</p>

        <div className="rounded-xl bg-slate-900/85 text-white p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words mt-4">
          {err.message}
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <Row k="서비스" v={err.service} />
          <Row k="상태 코드" v={<span className={statusChip(err.status_code)}>{err.status_code}</span>} />
          <Row k="경로" v={<span className="font-mono text-xs">{err.path}</span>} />
          <Row k="카테고리" v={CATEGORY_LABEL[entry.category]} />
          <Row k="자동 재시도 가능" v={entry.retryable ? "예" : "아니오"} />
          <Row
            k="사용자 인지"
            v={
              <span className={USER_VISIBILITY_CHIP[entry.userVisibility]}>
                {USER_VISIBILITY_LABEL[entry.userVisibility]}
              </span>
            }
          />
          <Row k="발생 횟수" v={err.count.toLocaleString()} />
          <Row k="최초" v={formatDate(err.first_seen)} />
          <Row k="최근" v={formatDate(err.last_seen)} />
        </dl>

        <div className="rounded-xl bg-white/60 border border-white/60 p-3 mt-3">
          <div className="text-xs text-muted mb-1">권장 조치</div>
          <p className="text-sm text-slate-800">{entry.recommendedAction}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            className="btn-primary text-sm disabled:opacity-50"
            type="button"
            disabled={!entry.retryable}
            onClick={() => onAction("retry_request")}
          >
            요청 재처리
          </button>
          <button className="btn-outline text-sm" type="button" onClick={() => onAction("open_runbook")}>
            런북 열기
          </button>
        </div>
        <p className="text-[11px] text-muted mt-3">※ 액션은 세션 audit trail 에 기록됩니다. 실제 재처리는 백엔드 연동 후.</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="text-sm text-slate-800 font-medium">{v}</dd>
    </div>
  );
}
