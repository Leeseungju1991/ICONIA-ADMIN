"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { LoadingState, EmptyState } from "../_components/CardStates";
import { listAuditLogAction } from "@/lib/actions/auditList";
import type { AuditEntry } from "@/lib/auditApi";
import { messageForCode } from "@/lib/errorMessages";

// 2026-06-01 — secops+ 전용 AuditLog 조회.
// 필터: action / outcome / operator_id / 날짜 범위. cursor 기반 페이지네이션.
// outcome 필터는 server endpoint 미지원 → client-side 필터.

const OUTCOME_CHIP: Record<string, string> = {
  success: "chip chip-success",
  ok: "chip chip-success",
  failed: "chip chip-error",
  error: "chip chip-error",
  blocked: "chip chip-warn",
};

const OUTCOME_LABEL: Record<string, string> = {
  success: "성공",
  ok: "성공",
  failed: "실패",
  error: "오류",
  blocked: "차단",
};

function nowMinusHours(h: number): string {
  return new Date(Date.now() - h * 3600 * 1000).toISOString().slice(0, 16);
}

const PAGE_LIMIT = 50;

export default function AuditClient() {
  const [action, setAction] = useState("");
  const [outcome, setOutcome] = useState("");
  const [operatorId, setOperatorId] = useState("");
  const [since, setSince] = useState<string>(nowMinusHours(24));
  const [until, setUntil] = useState<string>("");

  const [items, setItems] = useState<AuditEntry[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [currentCursor, setCurrentCursor] = useState<string | null>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, startLoad] = useTransition();
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const search = useCallback(
    (cursor: string | null) => {
      startLoad(async () => {
        const r = await listAuditLogAction({
          action: action || undefined,
          operatorId: operatorId || undefined,
          since: since ? new Date(since).toISOString() : undefined,
          cursor,
          limit: PAGE_LIMIT,
        });
        setHasSearched(true);
        if (!r.ok) {
          setError({ message: r.message, code: r.code });
          setItems([]);
          setNextCursor(null);
          return;
        }
        setError(null);
        setItems(r.items);
        setNextCursor(r.next_cursor);
        setCurrentCursor(cursor);
      });
    },
    [action, operatorId, since],
  );

  const handleSearch = useCallback(() => {
    setPrevCursors([]);
    setCurrentCursor(null);
    search(null);
  }, [search]);

  const handleNext = useCallback(() => {
    if (!nextCursor) return;
    setPrevCursors((cur) => [...cur, currentCursor ?? ""]);
    search(nextCursor);
  }, [nextCursor, currentCursor, search]);

  const handlePrev = useCallback(() => {
    if (prevCursors.length === 0) return;
    const prev = prevCursors[prevCursors.length - 1];
    setPrevCursors((cur) => cur.slice(0, -1));
    search(prev || null);
  }, [prevCursors, search]);

  // outcome / until 필터는 client-side.
  const filteredItems = useMemo(() => {
    const untilMs = until ? new Date(until).getTime() : null;
    return items.filter((r) => {
      if (outcome && (r.action_outcome ?? "") !== outcome) return false;
      if (untilMs != null) {
        const t = new Date(r.created_at).getTime();
        if (!Number.isFinite(t)) return true;
        if (t > untilMs) return false;
      }
      return true;
    });
  }, [items, outcome, until]);

  const columns: Column<AuditEntry>[] = useMemo(
    () => [
      {
        key: "created_at",
        header: "시각",
        render: (r) => (
          <span className="text-[11px] text-slate-700 whitespace-nowrap">
            {new Date(r.created_at).toLocaleString("ko-KR")}
          </span>
        ),
      },
      {
        key: "operator_email",
        header: "운영자",
        render: (r) => (
          <span className="text-[11px] text-slate-700">
            <code className="text-[10px] text-muted">
              {r.operator_id ? r.operator_id.slice(0, 12) : "—"}
            </code>
            <br />
            <span className="text-[10px] text-muted">{r.operator_role ?? "—"}</span>
          </span>
        ),
      },
      {
        key: "action",
        header: "동작",
        render: (r) => (
          <span className="font-mono text-xs text-slate-700">{r.action}</span>
        ),
      },
      {
        key: "outcome",
        header: "결과",
        render: (r) =>
          r.action_outcome ? (
            <span className={OUTCOME_CHIP[r.action_outcome] ?? "chip chip-info"}>
              {OUTCOME_LABEL[r.action_outcome] ?? r.action_outcome}
            </span>
          ) : (
            <span className="text-muted text-xs">—</span>
          ),
      },
      {
        key: "target_resource_type",
        header: "대상 유형",
        render: (r) => (
          <span className="text-[11px] text-slate-700">
            {r.target_resource_type ?? "—"}
          </span>
        ),
      },
      {
        key: "target_resource_id",
        header: "대상 ID",
        render: (r) => (
          <code className="text-[10px] text-muted">
            {r.target_resource_id ? r.target_resource_id.slice(0, 16) : "—"}
          </code>
        ),
      },
      {
        key: "ip",
        header: "IP",
        render: (r) => (
          <span className="font-mono text-[10px] text-slate-600">{r.ip || "—"}</span>
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
        description="운영자 활동 기록을 기간·동작·결과·담당자로 검색합니다."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
            <span className="block text-xs text-muted mb-1">종료 시각 (KST, 선택)</span>
            <input
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
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
            <span className="block text-xs text-muted mb-1">결과</span>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">전체</option>
              <option value="success">성공</option>
              <option value="ok">정상</option>
              <option value="failed">실패</option>
              <option value="error">오류</option>
              <option value="blocked">차단됨</option>
            </select>
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
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading}
            className="rounded-xl bg-slate-900 text-white text-sm px-4 py-2 disabled:opacity-40"
          >
            {loading ? "조회 중..." : "조회"}
          </button>
        </div>
      </PanelCard>

      <PanelCard
        title="결과"
        description="행을 클릭하면 상세 정보가 표시됩니다."
        actions={
          hasSearched && items.length > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handlePrev}
                disabled={loading || prevCursors.length === 0}
                className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300 disabled:opacity-40"
              >
                이전
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={loading || !nextCursor}
                className="rounded-lg bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300 disabled:opacity-40"
              >
                다음
              </button>
            </div>
          ) : null
        }
      >
        {!hasSearched ? (
          <div className="py-8 text-center text-xs text-muted">
            조건을 설정한 뒤 「조회」를 누르세요.
          </div>
        ) : loading ? (
          <LoadingState />
        ) : error ? (
          <EmptyState
            title="조회할 수 없음"
            hint={messageForCode(error.code, error.message)}
          />
        ) : filteredItems.length === 0 ? (
          <EmptyState title="해당 조건의 감사 로그가 없습니다." />
        ) : (
          <DataTable<AuditEntry>
            columns={columns}
            rows={filteredItems}
            empty="해당 조건의 감사 로그가 없습니다."
            rowKey={(r) => r.id}
            pageSize={50}
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
