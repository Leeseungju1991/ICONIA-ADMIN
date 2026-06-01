"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { DataTable, type Column } from "../../_components/DataTable";
import { searchLogsAction } from "@/lib/actions/logsSearch";
import type { LogEntryRow, LogLevel } from "@/lib/adminApi";

// V1.0 — 운영 로그 검색.
//
// Server `/api/v1/admin/logs/search` (SRE_OR_ABOVE).
// request-id / user-id / endpoint / status / level / time range / 자유텍스트.
// PII 는 server 가 마스킹.

const LEVEL_CHIP: Record<LogLevel, string> = {
  debug: "chip chip-info",
  info: "chip chip-info",
  warn: "chip chip-warn",
  error: "chip chip-error",
  fatal: "chip chip-error",
};

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error", "fatal"];

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

export default function OpsLogsPage() {
  const [from, setFrom] = useState<string>(nowMinusHours(1));
  const [to, setTo] = useState<string>("");
  const [level, setLevel] = useState<LogLevel | "">("");
  const [route, setRoute] = useState("");
  const [requestId, setRequestId] = useState("");
  const [userId, setUserId] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const [items, setItems] = useState<LogEntryRow[]>([]);
  const [approxTotal, setApproxTotal] = useState<number | null>(null);
  const [error, setError] = useState<{
    message: string;
    unreachable: boolean;
  } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [searching, startSearch] = useTransition();
  const [selectedRow, setSelectedRow] = useState<LogEntryRow | null>(null);

  const handleSearch = useCallback(() => {
    startSearch(async () => {
      const r = await searchLogsAction({
        from: from ? new Date(from).toISOString() : undefined,
        to: to ? new Date(to).toISOString() : undefined,
        level: level || undefined,
        route: route || undefined,
        request_id: requestId || undefined,
        user_id: userId || undefined,
        status: status || undefined,
        q: q || undefined,
        limit: 100,
      });
      setHasSearched(true);
      if (!r.ok) {
        setError(classifyError(r.message));
        setItems([]);
        setApproxTotal(null);
      } else {
        setError(null);
        setItems(r.items);
        setApproxTotal(r.approx_total);
      }
    });
  }, [from, to, level, route, requestId, userId, status, q]);

  const columns: Column<LogEntryRow>[] = useMemo(
    () => [
      {
        key: "at",
        header: "시각",
        render: (r) => (
          <span className="text-[11px] text-slate-700 whitespace-nowrap">
            {new Date(r.at).toLocaleString("ko-KR")}
          </span>
        ),
      },
      {
        key: "level",
        header: "LEVEL",
        render: (r) => <span className={LEVEL_CHIP[r.level]}>{r.level}</span>,
      },
      {
        key: "route",
        header: "ROUTE",
        render: (r) => (
          <code className="text-[11px] text-slate-700">
            {r.method ?? ""} {r.route ?? "—"}
          </code>
        ),
      },
      {
        key: "status",
        header: "STATUS",
        align: "right",
        render: (r) =>
          r.status != null ? (
            <span
              className={
                r.status >= 500
                  ? "text-rose-600 font-semibold"
                  : r.status >= 400
                    ? "text-amber-600 font-semibold"
                    : "text-slate-700"
              }
            >
              {r.status}
            </span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        key: "msg",
        header: "메시지",
        render: (r) => (
          <button
            type="button"
            className="text-left text-slate-700 hover:text-slate-900 underline-offset-2 hover:underline truncate max-w-[420px]"
            onClick={() => setSelectedRow(r)}
            title="raw 보기"
          >
            {r.message}
          </button>
        ),
      },
      {
        key: "req",
        header: "REQUEST-ID",
        render: (r) =>
          r.request_id ? (
            <code className="text-[10px] text-slate-600">
              {r.request_id.slice(0, 8)}
            </code>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <PanelCard
        title="로그 검색"
        description="시간·레벨·라우트·사용자·상태 등으로 검색합니다. 개인정보는 자동 마스킹됩니다."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="block">
            <span className="block text-xs text-muted mb-1">시작 (KST)</span>
            <input
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">종료 (선택)</span>
            <input
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">LEVEL</span>
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value as LogLevel | "")}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
            >
              <option value="">전체</option>
              {LEVELS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">STATUS</span>
            <input
              type="text"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              placeholder="200 / 4xx / 5xx"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">ROUTE prefix</span>
            <input
              type="text"
              value={route}
              onChange={(e) => setRoute(e.target.value)}
              placeholder="/api/v1/admin"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">REQUEST-ID</span>
            <input
              type="text"
              value={requestId}
              onChange={(e) => setRequestId(e.target.value)}
              placeholder="uuid"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">USER-ID</span>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="uuid"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
          </label>
          <label className="block">
            <span className="block text-xs text-muted mb-1">자유 검색</span>
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="메시지 substring"
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
            {searching ? "검색 중..." : "검색"}
          </button>
          <button
            type="button"
            onClick={() => {
              setLevel("");
              setRoute("");
              setRequestId("");
              setUserId("");
              setStatus("");
              setQ("");
              setFrom(nowMinusHours(1));
              setTo("");
            }}
            disabled={searching}
            className="rounded-xl bg-white text-slate-700 border border-slate-300 text-sm px-4 py-2"
          >
            초기화
          </button>
          {approxTotal != null ? (
            <span className="text-xs text-muted">
              매칭 약 {approxTotal.toLocaleString()}건 (표시 {items.length}건)
            </span>
          ) : null}
        </div>
      </PanelCard>

      <PanelCard
        title="검색 결과"
        description="메시지를 클릭하면 상세 내용이 우측에 표시됩니다."
      >
        {!hasSearched ? (
          <div className="py-8 text-center text-xs text-muted">
            조건을 설정한 뒤 「검색」을 누르세요.
          </div>
        ) : error ? (
          error.unreachable ? (
            <PreparingNotice endpoint="/api/v1/admin/logs/search" />
          ) : (
            <ErrorNotice message={error.message} />
          )
        ) : (
          <DataTable<LogEntryRow>
            columns={columns}
            rows={items}
            empty="조건에 맞는 로그가 없습니다."
            rowKey={(r, i) => `${r.at}-${r.request_id ?? i}`}
            pageSize={25}
          />
        )}
      </PanelCard>

      {selectedRow ? (
        <div className="fixed inset-0 z-50 flex">
          <button
            className="absolute inset-0 bg-slate-900/40"
            aria-label="닫기"
            onClick={() => setSelectedRow(null)}
          />
          <aside className="relative ml-auto h-full w-full max-w-xl bg-white border-l border-slate-200 shadow-card overflow-y-auto">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900 truncate">
                  로그 항목 raw
                </div>
                <div className="text-[11px] text-muted">
                  {new Date(selectedRow.at).toLocaleString("ko-KR")}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRow(null)}
                className="rounded-lg px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-sm"
              >
                닫기
              </button>
            </div>
            <div className="p-4 space-y-3 text-sm">
              <Field label="level" value={selectedRow.level} />
              <Field
                label="route"
                value={`${selectedRow.method ?? ""} ${selectedRow.route ?? "—"}`}
              />
              <Field
                label="status"
                value={selectedRow.status != null ? String(selectedRow.status) : "—"}
              />
              <Field
                label="request-id"
                value={selectedRow.request_id ?? "—"}
                mono
              />
              <Field label="user-id" value={selectedRow.user_id ?? "—"} mono />
              <Field
                label="operator-id"
                value={selectedRow.operator_id ?? "—"}
                mono
              />
              <Field
                label="error-code"
                value={selectedRow.error_code ?? "—"}
                mono
              />
              <div>
                <div className="text-[11px] text-muted mb-1">message</div>
                <pre className="text-xs bg-slate-50 rounded p-2 whitespace-pre-wrap break-all">
                  {selectedRow.message}
                </pre>
              </div>
              {selectedRow.extra ? (
                <div>
                  <div className="text-[11px] text-muted mb-1">extra</div>
                  <pre className="text-xs bg-slate-50 rounded p-2 whitespace-pre-wrap break-all">
                    {JSON.stringify(selectedRow.extra, null, 2)}
                  </pre>
                </div>
              ) : null}
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
  if (typeof console !== "undefined") {
    console.warn("[admin] preparing endpoint not yet available:", endpoint);
  }
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
      <div className="font-medium">준비 중</div>
      <div className="mt-1 text-xs text-muted">
        로그 검색을 준비 중입니다. 배포 완료 즉시 검색이 활성화됩니다.
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
