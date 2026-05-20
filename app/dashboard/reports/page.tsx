"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { OpsAuditTrailPanel } from "../_components/OpsAuditTrailPanel";
import { mockReports, formatDate, type ReportRow } from "@/lib/mockData";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";

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
  const [toast, setToast] = useState<string | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  // 신고 처리 결과를 세션 내 로컬 상태로 반영 — 백엔드 미연동, 새로고침 시 초기화.
  // TODO(server-wire-up): `/api/v1/admin/reports/:id/resolve` 연동 후 server 상태로 교체.
  const [statusOverrides, setStatusOverrides] = useState<Record<string, ReportRow["status"]>>({});

  const reports = useMemo(
    () => mockReports.map((r) => ({ ...r, status: statusOverrides[r.id] ?? r.status })),
    [statusOverrides],
  );

  const filtered = useMemo(
    () =>
      reports.filter((r) => {
        if (tab !== "all" && r.status !== tab) return false;
        if (typeFilter !== "all" && r.type !== typeFilter) return false;
        return true;
      }),
    [reports, tab, typeFilter],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: reports.length };
    for (const r of reports) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [reports]);

  // 신고 처리 액션 — 사유 입력 → 세션 audit trail 기록 → 로컬 상태 갱신.
  async function resolveReport(
    report: ReportRow,
    action: "hide" | "reject" | "warn" | "suspend",
  ) {
    const labels: Record<typeof action, string> = {
      hide: "콘텐츠 차단(숨김)",
      reject: "신고 반려",
      warn: "경고 메시지 발송",
      suspend: "신고 대상 계정 정지",
    };
    const label = labels[action];
    if ((action === "hide" || action === "suspend") && typeof window !== "undefined") {
      const phrase = window.prompt(
        `${label}\n\n강력 액션입니다. 실행하려면 정확히 "EXECUTE" 를 입력하세요.`,
      );
      if (phrase !== "EXECUTE") {
        setToast(`${label} 실행 취소 — 확인 문구 불일치.`);
        return;
      }
    }
    const reason = window.prompt(`${label} 사유를 입력하세요 (감사 로그에 기록됩니다, 5자 이상).`);
    if (!reason || reason.trim().length < 5) {
      setToast("사유가 5자 이상 필요합니다. 액션을 취소했습니다.");
      return;
    }
    const result = await recordOpsAuditWithSilentRetry({
      action: `report.${action}`,
      target_label: `${typeLabel[report.type]} · ${report.target_id}`,
      target_id: report.id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "queued",
    });
    setAuditTick((t) => t + 1);
    if (!result.ok) {
      setToast(`${label} 큐 적재 최종 실패 — 운영자 확인 필요. [${result.attempts}회 시도]`);
      return;
    }
    // 처리 결과를 신고 상태에 반영. reject → rejected, 그 외 → hidden/resolved.
    const nextStatus: ReportRow["status"] =
      action === "reject" ? "rejected" : action === "warn" ? "resolved" : "hidden";
    setStatusOverrides((prev) => ({ ...prev, [report.id]: nextStatus }));
    setPicked(null);
    setToast(`${label} 처리를 완료하고 감사 로그에 기록했습니다. (대상: ${report.target_id})`);
  }

  const summary = useMemo(() => {
    const pending = reports.filter((r) => r.status === "pending").length;
    const hidden = reports.filter((r) => r.status === "hidden").length;
    const resolved = reports.filter((r) => r.status === "resolved").length;
    const highVolume = reports.filter((r) => r.status === "pending" && r.reported_count >= 5).length;
    return { pending, hidden, resolved, highVolume };
  }, [reports]);

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
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="검토 대기"
          value={String(summary.pending)}
          delta={summary.pending > 0 ? "처리 필요" : "없음"}
          deltaTone={summary.pending > 0 ? "down" : "up"}
          hint="pending 신고"
          accent="orange"
        />
        <StatCard
          label="다발 신고 (5회+)"
          value={String(summary.highVolume)}
          hint="우선 검토 권장"
          accent="pink"
        />
        <StatCard label="차단 처리됨" value={String(summary.hidden)} hint="누적" accent="blue" />
        <StatCard label="처리 완료" value={String(summary.resolved)} hint="경고/조치 완료" accent="teal" />
      </section>

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

      <OpsAuditTrailPanel
        prefix="report."
        title="신고 처리 운영자 액션 audit (세션)"
        description="콘텐츠 차단·반려·경고·계정 정지 등 운영자 조치 기록. 백엔드 연동 후 Server audit_log 와 머지."
        refresh={{ tick: auditTick }}
      />

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card max-w-md">
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">
            닫기
          </button>
        </div>
      ) : null}

      {picked ? (
        <ReportDrawer
          report={picked}
          onClose={() => setPicked(null)}
          onResolve={(action) => resolveReport(picked, action)}
        />
      ) : null}
    </div>
  );
}

function ReportDrawer({
  report,
  onClose,
  onResolve,
}: {
  report: ReportRow;
  onClose: () => void;
  onResolve: (action: "hide" | "reject" | "warn" | "suspend") => void;
}) {
  const isClosed = report.status !== "pending";
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

        {isClosed ? (
          <div className="mt-6 text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
            ⚠ 이미 처리된 신고입니다 ({statusInfo[report.status].label}). 추가 조치가 필요하면 새 신고로 접수하세요.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-2">
            <button
              className="btn-primary text-sm"
              type="button"
              onClick={() => onResolve("hide")}
            >
              차단(숨김)
            </button>
            <button
              className="btn-outline text-sm"
              type="button"
              onClick={() => onResolve("reject")}
            >
              반려
            </button>
            <button
              className="btn-outline text-sm"
              type="button"
              onClick={() => onResolve("warn")}
            >
              경고 메시지
            </button>
            <button
              className="btn-danger text-sm"
              type="button"
              onClick={() => onResolve("suspend")}
            >
              계정 정지
            </button>
          </div>
        )}
        <p className="text-[11px] text-muted mt-3">
          ※ 차단·계정정지는 EXECUTE 2단계 확인 필수. 모든 조치는 사유 입력 후 세션 audit trail 에
          기록됩니다. 실제 콘텐츠 mutation 은 백엔드 연동 후 활성화. {/* TODO(server-wire-up) */}
        </p>
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
