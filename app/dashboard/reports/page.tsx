"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { mockReports, formatDate, type ReportRow } from "@/lib/mockData";

const typeLabel: Record<ReportRow["type"], string> = {
  review: "리뷰",
  post: "게시물",
  comment: "댓글",
  user: "사용자",
};

const statusInfo: Record<ReportRow["status"], { label: string; chip: string }> = {
  pending: { label: "검토 대기", chip: "chip chip-warn" },
  resolved: { label: "처리 완료", chip: "chip chip-success" },
  rejected: { label: "반려", chip: "chip chip-muted" },
  hidden: { label: "차단됨", chip: "chip chip-error" },
};

export default function ReportsPage() {
  const [tab, setTab] = useState<"all" | ReportRow["status"]>("pending");
  const [typeFilter, setTypeFilter] = useState<"all" | ReportRow["type"]>("all");
  const [picked, setPicked] = useState<ReportRow | null>(null);

  const filtered = useMemo(
    () =>
      mockReports.filter((r) => {
        if (tab !== "all" && r.status !== tab) return false;
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        return true;
      }),
    [tab, typeFilter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: mockReports.length };
    for (const r of mockReports) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, []);

  const columns: Column<ReportRow>[] = [
    { key: "type", header: "유형", render: (r) => <span className="chip chip-info">{typeLabel[r.type]}</span> },
    { key: "target", header: "대상", render: (r) => <span className="font-mono text-xs">{r.target_id}</span> },
    { key: "reason", header: "사유", render: (r) => r.reason },
    {
      key: "excerpt",
      header: "내용 발췌",
      render: (r) => <span className="text-slate-700 line-clamp-1 max-w-[300px] inline-block align-middle">{r.excerpt}</span>,
    },
    { key: "cnt", header: "신고 수", align: "right", render: (r) => r.reported_count },
    { key: "status", header: "상태", render: (r) => <span className={statusInfo[r.status].chip}>{statusInfo[r.status].label}</span> },
    { key: "date", header: "신고일", render: (r) => <span className="text-xs text-muted">{formatDate(r.created_at)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button className="btn-outline text-xs" type="button" onClick={() => setPicked(r)}>
          처리
        </button>
      ),
    },
  ];

  const tabs: Array<{ key: typeof tab; label: string }> = [
    { key: "pending", label: "검토 대기" },
    { key: "hidden", label: "차단됨" },
    { key: "resolved", label: "완료" },
    { key: "rejected", label: "반려" },
    { key: "all", label: "전체" },
  ];

  return (
    <div className="space-y-6">
      <PanelCard
        title="신고 처리 현황"
        description="이용자가 신고한 리뷰·게시물·댓글·사용자를 검토하고 운영 처리합니다."
        actions={
          <select
            className="select max-w-[160px]"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          >
            <option value="all">전체 유형</option>
            <option value="review">리뷰</option>
            <option value="post">게시물</option>
            <option value="comment">댓글</option>
            <option value="user">사용자</option>
          </select>
        }
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {tabs.map((t) => (
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
              {t.label} <span className="text-muted ml-1">{t.key === "all" ? counts.all : counts[t.key] ?? 0}</span>
            </button>
          ))}
        </div>

        <DataTable columns={columns} rows={filtered} empty="해당 조건의 신고가 없습니다." />
      </PanelCard>

      {picked ? <ReportDrawer report={picked} onClose={() => setPicked(null)} /> : null}
    </div>
  );
}

function ReportDrawer({ report, onClose }: { report: ReportRow; onClose: () => void }) {
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
        <h3 className="text-lg font-bold text-slate-900">신고 상세</h3>
        <p className="text-xs text-muted mt-0.5">{report.id}</p>

        <div className="mt-5 space-y-3 text-sm">
          <RowBlock label="유형" value={typeLabel[report.type]} />
          <RowBlock label="대상 ID" value={<span className="font-mono">{report.target_id}</span>} />
          <RowBlock label="신고자" value={<span className="font-mono">{report.reporter_id}</span>} />
          <RowBlock label="사유" value={report.reason} />
          <RowBlock label="신고 수" value={`${report.reported_count}회`} />
          <RowBlock label="상태" value={<span className={statusInfo[report.status].chip}>{statusInfo[report.status].label}</span>} />
          <RowBlock label="신고일" value={formatDate(report.created_at)} />
          <div className="rounded-xl bg-white/60 border border-white/60 p-3">
            <div className="text-xs text-muted mb-1">내용 발췌</div>
            <p className="text-sm text-slate-800">{report.excerpt}</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-primary text-sm" type="button">차단(숨김)</button>
          <button className="btn-outline text-sm" type="button">반려</button>
          <button className="btn-outline text-sm" type="button">경고 메시지</button>
          <button className="btn-danger text-sm" type="button">계정 정지</button>
        </div>
        <p className="text-[11px] text-muted mt-3">※ 데모 환경 — 실제 처리는 백엔드 연동 후 활성화됩니다.</p>
      </div>
    </div>
  );
}

function RowBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-slate-800 font-medium">{value}</span>
    </div>
  );
}
