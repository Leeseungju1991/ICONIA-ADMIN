"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { PanelCard } from "../../_components/PanelCard";
import { StatCard } from "../../_components/StatCard";
import { DataTable, type Column } from "../../_components/DataTable";
import { getSloSnapshotAction } from "@/lib/actions/slo";
import type {
  SloSnapshot,
  SloEndpointRow,
  SloDependencyRow,
} from "@/lib/adminApi";

// V1.0 — SLO 대시보드.
//
// Server `/api/v1/admin/metrics/slo` (SRE_OR_ABOVE). 5분 sliding window.
// API p50/p95/p99 / error rate / AI fallback / DB latency / 외부 의존성.
//
// SERVER 미배포 시 graceful "—" 표시 + "준비 중" 안내.

function classifyError(message: string): {
  message: string;
  unreachable: boolean;
} {
  const unreachable =
    message.startsWith("ERR_NETWORK") ||
    message.startsWith("ERR_SERVER_UNAVAILABLE") ||
    message.includes("not_found") ||
    message.includes("Not Found") ||
    message.includes("준비");
  return { message, unreachable };
}

function fmtMs(v: number | null | undefined): string {
  if (v == null) return "—";
  if (v < 10) return `${v.toFixed(1)} ms`;
  return `${Math.round(v).toLocaleString()} ms`;
}

function fmtRate(v: number | null | undefined): string {
  if (v == null) return "—";
  return `${(v * 100).toFixed(2)}%`;
}

const STATUS_CHIP: Record<SloDependencyRow["status"], string> = {
  ok: "chip chip-success",
  degraded: "chip chip-warn",
  down: "chip chip-error",
  not_applicable: "chip chip-info",
};

const STATUS_LABEL: Record<SloDependencyRow["status"], string> = {
  ok: "정상",
  degraded: "저하",
  down: "장애",
  not_applicable: "해당없음",
};

export default function OpsSloPage() {
  const [snapshot, setSnapshot] = useState<SloSnapshot | null>(null);
  const [error, setError] = useState<{ message: string; unreachable: boolean } | null>(null);
  const [loading, startLoad] = useTransition();

  const reload = useCallback(() => {
    startLoad(async () => {
      const r = await getSloSnapshotAction();
      if (!r.ok) {
        setError(classifyError(r.message));
        setSnapshot(null);
      } else {
        setError(null);
        setSnapshot(r.data);
      }
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  const overall = snapshot?.overall;
  const ai = snapshot?.ai;

  const routeColumns: Column<SloEndpointRow>[] = useMemo(
    () => [
      {
        key: "method",
        header: "METHOD",
        render: (r) => <span className="chip chip-info">{r.method}</span>,
      },
      {
        key: "route",
        header: "ROUTE",
        render: (r) => <code className="text-xs">{r.route}</code>,
      },
      {
        key: "calls",
        header: "호출",
        align: "right",
        render: (r) => r.calls.toLocaleString(),
      },
      {
        key: "p50",
        header: "p50",
        align: "right",
        render: (r) => fmtMs(r.p50),
      },
      {
        key: "p95",
        header: "p95",
        align: "right",
        render: (r) => fmtMs(r.p95),
      },
      {
        key: "p99",
        header: "p99",
        align: "right",
        render: (r) => fmtMs(r.p99),
      },
      {
        key: "err",
        header: "5xx",
        align: "right",
        render: (r) => (
          <span className={r.error_rate > 0.01 ? "text-rose-600 font-semibold" : ""}>
            {fmtRate(r.error_rate)}
          </span>
        ),
      },
      {
        key: "client",
        header: "4xx",
        align: "right",
        render: (r) => fmtRate(r.client_error_rate),
      },
    ],
    [],
  );

  const depColumns: Column<SloDependencyRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "의존성",
        render: (r) => <span className="font-mono text-xs">{r.name}</span>,
      },
      {
        key: "status",
        header: "상태",
        render: (r) => (
          <span className={STATUS_CHIP[r.status]}>{STATUS_LABEL[r.status]}</span>
        ),
      },
      {
        key: "latency",
        header: "응답",
        align: "right",
        render: (r) => fmtMs(r.latency_ms),
      },
      {
        key: "detail",
        header: "비고",
        render: (r) => <span className="text-xs text-slate-600">{r.detail}</span>,
      },
      {
        key: "at",
        header: "관측",
        render: (r) => (
          <span className="text-[11px] text-muted">
            {new Date(r.observed_at).toLocaleString("ko-KR")}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="API p95 (5분)"
          value={overall ? fmtMs(overall.p95) : "—"}
          hint={overall ? `호출 ${overall.calls.toLocaleString()}건` : "Server SLO"}
          accent="blue"
        />
        <StatCard
          label="API 5xx 비율"
          value={overall ? fmtRate(overall.error_rate) : "—"}
          hint={overall ? `4xx ${fmtRate(overall.client_error_rate)}` : "—"}
          accent={overall && overall.error_rate > 0.01 ? "pink" : "teal"}
        />
        <StatCard
          label="AI fallback"
          value={ai ? fmtRate(ai.fallback_rate) : "—"}
          hint={ai ? `p95 ${fmtMs(ai.p95_latency_ms)}` : "AI 호출"}
          accent={ai && ai.fallback_rate > 0.05 ? "pink" : "purple"}
        />
        <StatCard
          label="AI 호출/분"
          value={ai ? ai.calls_last_minute.toLocaleString() : "—"}
          hint={ai ? `오류율 ${fmtRate(ai.error_rate)}` : "—"}
          accent="orange"
        />
      </section>

      <PanelCard
        title="API 라우트별 SLO (5분 윈도우)"
        description="호출량이 많은 API 의 응답 속도와 오류율입니다. 오류율 1% 이상은 빨간색으로 강조됩니다."
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300 disabled:opacity-60"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        {error ? (
          error.unreachable ? (
            <PreparingNotice endpoint="/api/v1/admin/metrics/slo" />
          ) : (
            <ErrorNotice message={error.message} />
          )
        ) : !snapshot ? (
          <div className="py-8 text-center text-xs text-muted">로딩 중...</div>
        ) : (
          <DataTable<SloEndpointRow>
            columns={routeColumns}
            rows={snapshot.by_route}
            empty="라우트 통계가 비어 있습니다."
            rowKey={(r) => `${r.method}:${r.route}`}
          />
        )}
      </PanelCard>

      <PanelCard
        title="외부 의존성 상태"
        description="DB·캐시·AI·커머스 등 외부 시스템의 최근 상태입니다."
      >
        {error ? (
          error.unreachable ? (
            <PreparingNotice endpoint="/api/v1/admin/metrics/slo" />
          ) : (
            <ErrorNotice message={error.message} />
          )
        ) : !snapshot ? (
          <div className="py-8 text-center text-xs text-muted">로딩 중...</div>
        ) : (
          <DataTable<SloDependencyRow>
            columns={depColumns}
            rows={snapshot.dependencies}
            empty="의존성 정보가 비어 있습니다."
            rowKey={(r) => r.name}
          />
        )}
      </PanelCard>

      <PanelCard
        title="관련 페이지"
        description="문제 발생 시 바로 이동할 수 있는 페이지입니다."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <RelatedLink
            href="/dashboard/ops/alerts"
            title="알람 설정"
            desc="임계치 + 채널 (이메일/슬랙) 토글"
          />
          <RelatedLink
            href="/dashboard/ops/logs"
            title="로그 검색"
            desc="request-id / endpoint / status 필터"
          />
          <RelatedLink
            href="/dashboard/ops/runbook"
            title="장애 대응 runbook"
            desc="알람별 대응 절차 모음"
          />
          <RelatedLink
            href="/dashboard/ops"
            title="운영 안정성 통합"
            desc="kill switch · DLQ · feature flag"
          />
          <RelatedLink
            href="/dashboard/ops/audit"
            title="감사 로그"
            desc="모든 admin 변경 작업 추적"
          />
        </div>
      </PanelCard>
    </div>
  );
}

function PreparingNotice({ endpoint }: { endpoint: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700">
      <div className="font-medium">준비 중</div>
      <div className="mt-1 text-xs text-muted">
        Server endpoint <code>{endpoint}</code> 가 아직 배포되지 않았습니다. 배포
        완료 즉시 자동 표시됩니다.
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

function RelatedLink({
  href,
  title,
  desc,
}: {
  href: string;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="block rounded-xl border border-slate-200 bg-white px-3 py-3 hover:bg-slate-50 transition"
    >
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="text-[11px] text-muted mt-0.5">{desc}</div>
    </Link>
  );
}
