"use client";

// 2026-06-10 — 분실/도난 신고 접수 (Lost Report) 관리 페이지.
// Server: GET /api/v1/admin/lost-reports · PATCH /api/v1/admin/lost-reports/:id
//
// 기존 `/dashboard/reports`(신고된 피드) 와 별개 surface — APP 사용자가
// "분실/도난 신고" 양식으로 접수한 항목을 처리. 4 필드 + 상태 라이프사이클.

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { AdminToast, useAdminToast } from "../_components/AdminToast";
import { StatCard } from "../_components/StatCard";
import {
  listLostReportsAction,
  updateLostReportStatusAction,
} from "@/lib/actions/lostReports";
import type { LostReportRow, LostReportStatus } from "@/lib/adminApi";

const statusChip: Record<LostReportStatus, string> = {
  pending: "chip chip-warn",
  in_progress: "chip chip-info",
  resolved: "chip chip-success",
  rejected: "chip chip-muted",
};
const statusLabel: Record<LostReportStatus, string> = {
  pending: "접수 대기",
  in_progress: "처리 중",
  resolved: "해결",
  rejected: "반려",
};

type Tab = "all" | LostReportStatus;
const TABS: Array<{ key: Tab; label: string }> = [
  { key: "pending", label: "접수 대기" },
  { key: "in_progress", label: "처리 중" },
  { key: "resolved", label: "해결" },
  { key: "rejected", label: "반려" },
  { key: "all", label: "전체" },
];

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

export default function LostReportsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [rows, setRows] = useState<LostReportRow[]>([]);
  const [picked, setPicked] = useState<LostReportRow | null>(null);
  const { toast, setToast } = useAdminToast();
  const [error, setError] = useState<{ message: string; unreachable: boolean } | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listLostReportsAction({
        status: tab === "all" ? undefined : tab,
        limit: 100,
      });
      if (!r.ok) {
        const unreachable =
          r.message.startsWith("ERR_NETWORK") ||
          r.message.startsWith("ERR_SERVER_UNAVAILABLE");
        setError({ message: r.message, unreachable });
        setRows([]);
      } else {
        setError(null);
        setRows(r.data.items);
      }
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const summary = useMemo(() => {
    const pending = rows.filter((r) => r.status === "pending").length;
    const inProgress = rows.filter((r) => r.status === "in_progress").length;
    const resolved = rows.filter((r) => r.status === "resolved").length;
    return { pending, inProgress, resolved, total: rows.length };
  }, [rows]);

  async function setStatus(report: LostReportRow, status: LostReportStatus) {
    const fd = new FormData();
    fd.append("id", report.id);
    fd.append("status", status);
    const r = await updateLostReportStatusAction(fd);
    if (!r.ok) {
      setToast({ message: `상태 변경 실패: ${r.message}`, tone: "error" });
      return;
    }
    setToast({ message: `신고 ${report.id.slice(0, 8)}… 상태 → ${statusLabel[status]} 변경 완료.`, tone: "success" });
    setPicked(null);
    reload();
  }

  type Row = LostReportRow & { _id: string };
  const columns: Column<Row>[] = [
    {
      key: "created_at",
      header: "접수 시각",
      render: (r) => <span className="text-xs text-muted">{fmtDate(r.created_at)}</span>,
    },
    {
      key: "user_id",
      header: "신고자",
      render: (r) => <span className="font-mono text-xs">{r.user_id.slice(0, 8)}…</span>,
    },
    {
      key: "doll_identifier",
      header: "인형 식별 정보",
      render: (r) => <span className="font-mono text-xs">{truncate(r.doll_identifier, 28)}</span>,
    },
    {
      key: "incident_at",
      header: "분실/도난 일시",
      render: (r) => <span className="text-xs">{fmtDate(r.incident_at)}</span>,
    },
    {
      key: "last_location",
      header: "마지막 위치",
      render: (r) => (
        <span className="text-slate-700 line-clamp-1 max-w-[180px] inline-block align-middle">
          {truncate(r.last_location, 30)}
        </span>
      ),
    },
    {
      key: "description",
      header: "상황 설명",
      render: (r) => (
        <span className="text-slate-700 line-clamp-1 max-w-[260px] inline-block align-middle">
          {truncate(r.description, 60)}
        </span>
      ),
    },
    {
      key: "status",
      header: "상태",
      render: (r) => (
        <span className={statusChip[r.status] ?? "chip chip-muted"}>
          {statusLabel[r.status] ?? r.status}
        </span>
      ),
    },
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
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="접수 대기"
          value={String(summary.pending)}
          delta={summary.pending > 0 ? "처리 필요" : "없음"}
          deltaTone={summary.pending > 0 ? "down" : "up"}
          hint="아직 처리되지 않은 신고"
          accent="orange"
        />
        <StatCard label="처리 중" value={String(summary.inProgress)} hint="담당자 확인 중" accent="blue" />
        <StatCard label="해결 완료" value={String(summary.resolved)} hint="누적" accent="teal" />
        <StatCard label="전체" value={String(summary.total)} hint="현재 필터 기준" accent="pink" />
      </section>

      <PanelCard
        title="분실/도난 신고"
        description="APP 사용자가 접수한 분실/도난 신고를 검토·처리합니다."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-accent px-3 py-1.5 text-xs text-white disabled:opacity-60"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={[
                "rounded-full px-3.5 py-1.5 text-xs font-medium border transition",
                tab === t.key
                  ? "bg-white/85 border-white/80 text-slate-900 shadow-card"
                  : "bg-white/40 border-white/50 text-slate-600 hover:bg-white/60",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {error ? (
          <div className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error.unreachable
              ? "Server 에 도달할 수 없습니다 — 준비 중일 수 있습니다."
              : `조회 실패: ${error.message}`}
          </div>
        ) : null}

        <DataTable
          columns={columns}
          rows={rows.map((r) => ({ ...r, _id: r.id }))}
          rowKey={(r) => r.id}
          empty="해당 조건의 신고가 없습니다."
        />
      </PanelCard>

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />

      {picked ? (
        <ReportDrawer
          report={picked}
          onClose={() => setPicked(null)}
          onSetStatus={(status) => setStatus(picked, status)}
        />
      ) : null}
    </div>
  );
}

function ReportDrawer({
  report,
  onClose,
  onSetStatus,
}: {
  report: LostReportRow;
  onClose: () => void;
  onSetStatus: (status: LostReportStatus) => void;
}) {
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
        <h3 className="text-lg font-bold text-slate-900">분실/도난 신고 상세</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{report.id}</p>

        <dl className="mt-5 space-y-3 text-sm">
          <RowBlock label="접수 시각" value={fmtDate(report.created_at)} />
          <RowBlock label="신고자" value={<span className="font-mono">{report.user_id}</span>} />
          <RowBlock label="인형 식별 정보" value={<span className="font-mono">{report.doll_identifier}</span>} />
          <RowBlock label="분실/도난 일시" value={fmtDate(report.incident_at)} />
          <RowBlock label="마지막 위치" value={report.last_location} />
          <RowBlock
            label="상태"
            value={
              <span className={statusChip[report.status] ?? "chip chip-muted"}>
                {statusLabel[report.status] ?? report.status}
              </span>
            }
          />
          <div className="rounded-xl bg-white/60 border border-white/60 p-3">
            <div className="text-xs text-muted mb-1">상황 설명</div>
            <p className="text-sm text-slate-800 whitespace-pre-wrap">{report.description}</p>
          </div>
        </dl>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            type="button"
            className="btn-outline text-sm disabled:opacity-50"
            disabled={report.status === "in_progress"}
            onClick={() => onSetStatus("in_progress")}
          >
            처리 중으로
          </button>
          <button
            type="button"
            className="btn-outline text-sm disabled:opacity-50"
            disabled={report.status === "pending"}
            onClick={() => onSetStatus("pending")}
          >
            대기로 되돌리기
          </button>
          <button
            type="button"
            className="btn-primary text-sm disabled:opacity-50"
            disabled={report.status === "resolved"}
            onClick={() => onSetStatus("resolved")}
          >
            해결 처리
          </button>
          <button
            type="button"
            className="btn-danger text-sm disabled:opacity-50"
            disabled={report.status === "rejected"}
            onClick={() => onSetStatus("rejected")}
          >
            반려
          </button>
        </div>
        <p className="text-[11px] text-muted mt-3">
          ※ 상태 변경은 Server 에 즉시 반영됩니다. resolved/rejected 도 다시 처리 중으로 되돌릴 수
          있습니다.
        </p>
      </div>
    </div>
  );
}

function RowBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-slate-800 font-medium text-right break-all">{value}</span>
    </div>
  );
}
