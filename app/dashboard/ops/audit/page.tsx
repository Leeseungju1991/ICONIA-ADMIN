"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { DataTable, type Column } from "../../_components/DataTable";
import { listAuditLogAction } from "@/lib/actions/auditList";
import type { AuditEntry } from "@/lib/auditApi";

// V1.0 — 감사 로그 뷰어.
//
// Server `/api/v1/admin/audit-log` (secops/sre/superadmin). hash chain 정본.
// CSV export 지원 (운영자가 컴플라이언스 자료 제출 시).

function classifyError(message: string): {
  message: string;
  unreachable: boolean;
} {
  const unreachable =
    message.startsWith("ERR_NETWORK") ||
    message.startsWith("ERR_SERVER_UNAVAILABLE") ||
    message.includes("not_found") ||
    message.includes("Not Found");
  return { message, unreachable };
}

function nowMinusHours(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString().slice(0, 16);
}

function escapeCsv(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function downloadCsv(rows: AuditEntry[]) {
  const headers = [
    "at",
    "sequence_no",
    "action",
    "operator_id",
    "operator_role",
    "target_type",
    "target_id",
    "outcome",
    "ip",
    "request_id",
    "current_hash",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.sequence_no,
        r.action,
        r.operator_id,
        r.operator_role,
        r.target_resource_type,
        r.target_resource_id,
        r.action_outcome,
        r.ip,
        r.request_id,
        r.current_hash,
      ]
        .map(escapeCsv)
        .join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${Date.now()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const OUTCOME_CHIP: Record<string, string> = {
  success: "chip chip-success",
  failed: "chip chip-error",
  blocked: "chip chip-warn",
};

export default function OpsAuditPage() {
  const [action, setAction] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [targetType, setTargetType] = useState("");
  const [since, setSince] = useState<string>(nowMinusHours(24));

  const [items, setItems] = useState<AuditEntry[]>([]);
  const [error, setError] = useState<{
    message: string;
    unreachable: boolean;
  } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, startSearch] = useTransition();
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const handleSearch = useCallback(() => {
    startSearch(async () => {
      const r = await listAuditLogAction({
        action: action || undefined,
        operatorId: operatorId || undefined,
        targetType: targetType || undefined,
        since: since ? new Date(since).toISOString() : undefined,
        limit: 100,
      });
      setHasSearched(true);
      if (!r.ok) {
        setError(classifyError(r.message));
        setItems([]);
      } else {
        setError(null);
        setItems(r.items);
      }
    });
  }, [action, operatorId, targetType, since]);

  const columns: Column<AuditEntry>[] = useMemo(
    () => [
      {
        key: "at",
        header: "시각",
        render: (r) => (
          <span className="text-[11px] text-slate-700 whitespace-nowrap">
            {new Date(r.created_at).toLocaleString("ko-KR")}
          </span>
        ),
      },
      {
        key: "seq",
        header: "SEQ",
        align: "right",
        render: (r) => (
          <span className="font-mono text-[11px] text-slate-600">
            {r.sequence_no ?? "—"}
          </span>
        ),
      },
      {
        key: "action",
        header: "ACTION",
        render: (r) => (
          <span className="font-mono text-xs text-slate-700">{r.action}</span>
        ),
      },
      {
        key: "op",
        header: "운영자",
        render: (r) => (
          <span className="text-[11px] text-slate-700">
            {r.operator_role ?? "—"}
            <br />
            <code className="text-[10px] text-muted">
              {r.operator_id ? r.operator_id.slice(0, 8) : "—"}
            </code>
          </span>
        ),
      },
      {
        key: "target",
        header: "대상",
        render: (r) => (
          <span className="text-[11px] text-slate-700">
            {r.target_resource_type ?? "—"}
            <br />
            <code className="text-[10px] text-muted">
              {r.target_resource_id
                ? r.target_resource_id.slice(0, 16)
                : "—"}
            </code>
          </span>
        ),
      },
      {
        key: "outcome",
        header: "결과",
        render: (r) =>
          r.action_outcome ? (
            <span
              className={
                OUTCOME_CHIP[r.action_outcome] ?? "chip chip-info"
              }
            >
              {r.action_outcome}
            </span>
          ) : (
            <span className="text-muted text-xs">—</span>
          ),
      },
      {
        key: "detail",
        header: "상세",
        render: (r) => (
          <button
            type="button"
            className="text-xs text-accent hover:underline"
            onClick={() => setSelected(r)}
          >
            보기 →
          </button>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PanelCard
        title="감사 로그 검색"
        description="action / 운영자 / 대상 type / 시작 시각. hash chain 정본 — Server 가 무결성 보장."
        actions={
          items.length > 0 ? (
            <button
              type="button"
              onClick={() => downloadCsv(items)}
              className="rounded-xl bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300"
            >
              CSV 내보내기 ({items.length}건)
            </button>
          ) : null
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-xs text-muted mb-1">시작 시각 (KST)</span>
            <input
              type="datetime-local"
              value={since}
              onChange={(e) => setSince(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">ACTION</span>
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="user.force_logout"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">운영자 ID</span>
            <input
              type="text"
              value={operatorId}
              onChange={(e) => setOperatorId(e.target.value)}
              placeholder="uuid"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">대상 type</span>
            <input
              type="text"
              value={targetType}
              onChange={(e) => setTargetType(e.target.value)}
              placeholder="user / device / firmware"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSearch}
            disabled={searching}
            className="rounded-xl bg-slate-900 text-white text-sm px-4 py-2 disabled:opacity-40"
          >
            {searching ? "조회 중..." : "조회"}
          </button>
        </div>
      </PanelCard>

      <PanelCard title="결과" description="상세 row 를 클릭하면 metadata 와 hash 가 표시됩니다.">
        {!hasSearched ? (
          <div className="py-8 text-center text-xs text-muted">
            조건을 설정한 뒤 「조회」를 누르세요.
          </div>
        ) : error ? (
          error.unreachable ? (
            <PreparingNotice endpoint="/api/v1/admin/audit-log" />
          ) : (
            <ErrorNotice message={error.message} />
          )
        ) : (
          <DataTable<AuditEntry>
            columns={columns}
            rows={items}
            empty="해당 조건의 감사 로그가 없습니다."
            rowKey={(r) => r.id}
            pageSize={25}
          />
        )}
      </PanelCard>

      {selected ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            className="absolute inset-0 bg-slate-900/40"
            aria-label="닫기"
            onClick={() => setSelected(null)}
          />
          <aside className="relative ml-auto h-full w-full max-w-xl bg-white border-l border-slate-200 shadow-card overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  감사 로그 #{selected.sequence_no ?? "—"}
                </div>
                <div className="text-[11px] text-muted">
                  {new Date(selected.created_at).toLocaleString("ko-KR")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-sm"
              >
                닫기
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <Field label="action" value={selected.action} mono />
              <Field
                label="operator"
                value={`${selected.operator_role ?? "—"} / ${selected.operator_id ?? "—"}`}
                mono
              />
              <Field
                label="target"
                value={`${selected.target_resource_type ?? "—"} / ${selected.target_resource_id ?? "—"}`}
                mono
              />
              <Field label="outcome" value={selected.action_outcome ?? "—"} />
              <Field label="ip" value={selected.ip ?? "—"} mono />
              <Field
                label="user_agent"
                value={selected.user_agent ?? "—"}
              />
              <Field
                label="request_id"
                value={selected.request_id ?? "—"}
                mono
              />
              <Field
                label="prev_hash"
                value={selected.prev_hash ?? "—"}
                mono
              />
              <Field
                label="current_hash"
                value={selected.current_hash ?? "—"}
                mono
              />
              <div>
                <div className="text-[11px] text-muted mb-1">metadata</div>
                <pre className="text-xs bg-slate-50 rounded p-2 whitespace-pre-wrap break-all">
                  {selected.metadata != null
                    ? JSON.stringify(selected.metadata, null, 2)
                    : "—"}
                </pre>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-muted">{label}</div>
      <div
        className={`text-sm text-slate-700 ${mono ? "font-mono break-all" : ""}`}
      >
        {value}
      </div>
    </div>
  );
}

function PreparingNotice({ endpoint }: { endpoint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
      <div className="font-medium">준비 중</div>
      <div className="mt-1 text-xs text-muted">
        Server endpoint <code>{endpoint}</code> 도달 불가. 권한 또는 endpoint 미배포.
      </div>
    </div>
  );
}

function ErrorNotice({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      조회 실패: {message}
    </div>
  );
}
