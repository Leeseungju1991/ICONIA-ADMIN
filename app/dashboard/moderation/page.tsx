"use client";

// 2026-05-27 — 모더레이션 통합 (◈6번).
// GET /api/admin/reports?status=open  — kind=post|comment|review|user 탭.
// 한 줄에 신고대상/사유/카운트/조치(가림·삭제·계정정지). 미해결 1+ 면 시각적 강조.

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import { AdminToast, useAdminToast } from "../_components/AdminToast";
import { EmptyState, ErrorState, FixtureBadge, LoadingState } from "../_components/CardStates";
import { listReportsAction, resolveReportAction } from "@/lib/actions/reportsAdmin";
import type {
  ReportAction,
  ReportRow,
  ReportTargetKind,
  ReportsResponse,
} from "@/types/admin-api";

const KIND_LABEL: Record<ReportTargetKind | "all", string> = {
  all: "전체",
  post: "게시물",
  comment: "댓글",
  review: "리뷰",
  user: "사용자",
};

const ACTION_LABEL: Record<ReportAction, string> = {
  hide: "가림",
  remove: "삭제",
  suspend_user: "계정정지",
  dismiss: "기각",
};

const REASON_BADGE = (reason: string) => {
  // 욕설/혐오 강조 — 색 빨강 + 아이콘 정도, 자극적이지 않게.
  const lower = reason.toLowerCase();
  const harsh = /욕설|혐오|비방|hate|abuse/i.test(lower);
  return harsh ? "chip chip-error" : "chip chip-warn";
};

export default function ModerationPage() {
  const [kind, setKind] = useState<ReportTargetKind | "all">("all");
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [error, setError] = useState<{ message: string; unreachable: boolean } | null>(null);
  const [source, setSource] = useState<"server" | "fixture" | null>(null);
  const [picked, setPicked] = useState<ReportRow | null>(null);
  const { toast, setToast } = useAdminToast();
  const [loading, startLoad] = useTransition();
  const [acting, startAct] = useTransition();

  function reload() {
    startLoad(async () => {
      const r = await listReportsAction({
        status: "open",
        kind: kind === "all" ? undefined : kind,
      });
      if (!r.ok) {
        setError({ message: r.message, unreachable: !!r.unreachable });
        setData(null);
        return;
      }
      setError(null);
      setData(r.data);
      setSource(r.source);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  // 30초 폴링 — 미해결 신고가 실시간 반영되도록.
  useEffect(() => {
    const t = setInterval(reload, 30_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind]);

  const items: ReportRow[] = useMemo(() => data?.items ?? [], [data]);
  const totalOpen = data?.total_open ?? 0;

  const breakdown = useMemo(() => {
    const counts: Record<ReportTargetKind, number> = {
      post: 0,
      comment: 0,
      review: 0,
      user: 0,
    };
    for (const r of items) counts[r.target_kind]++;
    return counts;
  }, [items]);

  async function handleResolve(r: ReportRow, action: ReportAction) {
    const confirmLabel = ACTION_LABEL[action];
    const phrase =
      action === "suspend_user" || action === "remove"
        ? window.prompt(
            `${confirmLabel} 실행\n\n강력 액션입니다. 실행하려면 정확히 "EXECUTE" 를 입력하세요.`,
          )
        : "EXECUTE";
    if (phrase !== "EXECUTE") {
      setToast({ message: "실행 취소 — 확인 문구 불일치.", tone: "warning" });
      return;
    }
    const reason = window.prompt(`${confirmLabel} 사유 (5자 이상, 감사 로그 기록):`);
    if (!reason || reason.trim().length < 5) {
      setToast({ message: "사유가 5자 이상 필요합니다.", tone: "warning" });
      return;
    }
    startAct(async () => {
      const res = await resolveReportAction({
        reportId: r.id,
        action,
        reason: reason.trim(),
      });
      if (!res.ok) {
        setToast({ message: `처리 실패: ${res.message}`, tone: "error" });
        return;
      }
      setToast({ message: `${confirmLabel} 처리 완료 — ${r.id}`, tone: "success" });
      setPicked(null);
      reload();
    });
  }

  const harshCount = items.filter((r) => /욕설|혐오|비방|hate|abuse/i.test(r.reason)).length;

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="미해결 신고"
          value={totalOpen.toLocaleString()}
          delta={totalOpen > 0 ? "처리 필요" : "없음"}
          deltaTone={totalOpen > 0 ? "down" : "up"}
          hint="status=open 전체"
          accent={totalOpen > 0 ? "pink" : "teal"}
        />
        <StatCard
          label="욕설/혐오"
          value={String(harshCount)}
          delta={harshCount > 0 ? "최우선" : "없음"}
          deltaTone={harshCount > 0 ? "down" : "up"}
          hint="reason 분류"
          accent="pink"
        />
        <StatCard
          label="게시물 / 댓글"
          value={`${breakdown.post} / ${breakdown.comment}`}
          hint="현재 보기 기준"
          accent="orange"
        />
        <StatCard
          label="사용자 / 리뷰"
          value={`${breakdown.user} / ${breakdown.review}`}
          hint="현재 보기 기준"
          accent="blue"
        />
      </section>

      <PanelCard
        title="미해결 신고 — 통합 보기"
        description="처리되지 않은 신고를 30초마다 자동 갱신합니다. 욕설·혐오·비방은 빨간색으로 강조됩니다."
        actions={
          <div className="flex items-center gap-2">
            {source === "fixture" ? <FixtureBadge /> : null}
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-lg bg-white border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "조회 중..." : "새로고침"}
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {(["all", "post", "comment", "review", "user"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={[
                "rounded-full px-3 py-1.5 text-xs font-medium border transition",
                kind === k
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {KIND_LABEL[k]}
              {k !== "all" ? (
                <span className="ml-1 text-[10px] opacity-80">
                  {breakdown[k]}
                </span>
              ) : null}
            </button>
          ))}
        </div>

        {error ? (
          <ErrorState message={error.message} unreachable={error.unreachable} onRetry={reload} />
        ) : !data ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState title="미해결 신고 없음" hint="모든 신고가 처리됨." />
        ) : (
          <ul className="space-y-2">
            {items.map((r) => (
              <ReportRowItem
                key={r.id}
                r={r}
                onAction={(a) => handleResolve(r, a)}
                onPick={() => setPicked(r)}
                disabled={acting}
              />
            ))}
          </ul>
        )}
      </PanelCard>

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />

      {picked ? (
        <ReportDrawer
          report={picked}
          onClose={() => setPicked(null)}
          onResolve={(a) => handleResolve(picked, a)}
          disabled={acting}
        />
      ) : null}
    </div>
  );
}

function ReportRowItem({
  r,
  onAction,
  onPick,
  disabled,
}: {
  r: ReportRow;
  onAction: (a: ReportAction) => void;
  onPick: () => void;
  disabled: boolean;
}) {
  const harsh = /욕설|혐오|비방|hate|abuse/i.test(r.reason);
  return (
    <li
      className={[
        "rounded-xl border px-3 py-2.5 flex items-start justify-between gap-3 flex-wrap",
        harsh ? "border-rose-200 bg-rose-50/40" : "border-slate-200 bg-white",
      ].join(" ")}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="chip chip-muted">{KIND_LABEL[r.target_kind]}</span>
          <span className={REASON_BADGE(r.reason)}>
            {harsh ? "⚠ " : ""}
            {r.reason}
          </span>
          <span className="text-[11px] font-mono text-slate-500">{r.target_id}</span>
          {r.in_progress_by ? (
            <span className="chip chip-info">처리중 · {r.in_progress_by}</span>
          ) : null}
        </div>
        {r.target_excerpt ? (
          <p className="mt-1 text-xs text-slate-700 line-clamp-2">{r.target_excerpt}</p>
        ) : null}
        <div className="mt-1 text-[11px] text-slate-500">
          누적 신고 {r.reported_count}회 · 마지막{" "}
          {new Date(r.last_reported_at).toLocaleString("ko-KR")}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onAction("hide")}
          disabled={disabled}
          className="rounded-lg bg-white border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
        >
          가림
        </button>
        <button
          type="button"
          onClick={() => onAction("remove")}
          disabled={disabled}
          className="rounded-lg bg-rose-50 border border-rose-200 px-2.5 py-1 text-xs text-rose-700 hover:bg-rose-100 disabled:opacity-60"
        >
          삭제
        </button>
        {r.target_kind === "user" ? (
          <button
            type="button"
            onClick={() => onAction("suspend_user")}
            disabled={disabled}
            className="rounded-lg bg-rose-600 border border-rose-700 px-2.5 py-1 text-xs text-white hover:bg-rose-700 disabled:opacity-60"
          >
            계정정지
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onAction("dismiss")}
          disabled={disabled}
          className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50 disabled:opacity-60"
        >
          기각
        </button>
        <button
          type="button"
          onClick={onPick}
          className="rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-xs text-slate-500"
        >
          상세
        </button>
      </div>
    </li>
  );
}

function ReportDrawer({
  report,
  onClose,
  onResolve,
  disabled,
}: {
  report: ReportRow;
  onClose: () => void;
  onResolve: (a: ReportAction) => void;
  disabled: boolean;
}) {
  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/30">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 relative shadow-card">
        <button
          className="absolute right-4 top-4 rounded-lg px-3 py-1 bg-slate-100 hover:bg-slate-200 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">신고 상세</h3>
        <p className="text-xs text-slate-500 mt-0.5 font-mono">{report.id}</p>
        <dl className="mt-5 space-y-2 text-sm">
          <Row label="대상 종류" value={KIND_LABEL[report.target_kind]} />
          <Row label="대상 ID" value={<span className="font-mono">{report.target_id}</span>} />
          <Row label="사유" value={<span className={REASON_BADGE(report.reason)}>{report.reason}</span>} />
          <Row label="누적 신고" value={`${report.reported_count}회`} />
          <Row label="마지막 신고" value={new Date(report.last_reported_at).toLocaleString("ko-KR")} />
          {report.target_excerpt ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3">
              <div className="text-xs text-slate-500 mb-1">발췌</div>
              <p className="text-sm text-slate-800 whitespace-pre-wrap">{report.target_excerpt}</p>
            </div>
          ) : null}
        </dl>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="btn-outline text-sm" onClick={() => onResolve("hide")} disabled={disabled} type="button">
            가림
          </button>
          <button className="btn-danger text-sm" onClick={() => onResolve("remove")} disabled={disabled} type="button">
            삭제
          </button>
          {report.target_kind === "user" ? (
            <button className="btn-danger text-sm col-span-2" onClick={() => onResolve("suspend_user")} disabled={disabled} type="button">
              계정정지
            </button>
          ) : null}
          <button className="btn-outline text-sm col-span-2" onClick={() => onResolve("dismiss")} disabled={disabled} type="button">
            기각
          </button>
        </div>
        <p className="text-[11px] text-slate-500 mt-3">
          ※ 삭제·계정정지는 EXECUTE 2단계 확인 + 5자 사유 prompt 필수. 모든 조치는
          서버 audit_log 에 기록됩니다.
        </p>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-sm text-slate-800 font-medium">{value}</span>
    </div>
  );
}
