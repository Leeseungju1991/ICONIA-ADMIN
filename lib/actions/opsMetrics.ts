"use server";

// 2026-06-25 — [PDF #13] ops 인프라 CloudWatch 메트릭 server actions.
//   Server proxy: GET /api/v1/admin/ops/metrics
//   이전: opsInfraMock.ts 의 static mock 데이터.
//   현재: SERVER 가 CloudWatch GetMetricStatistics 를 호출하고 datapoints 반환.
//   SERVER agent 가 endpoint 를 구현하면 mock 없이 실 데이터로 동작한다.
//   endpoint 미구현 시 ok:false + code:ERR_NOT_IMPLEMENTED 반환 → UI graceful 분기.

import { readSession } from "@/lib/authCookie";
import { fetchOpsMetrics, type OpsMetricResult } from "@/lib/adminApi";

export type OpsMetricActionResult =
  | { ok: true; data: OpsMetricResult }
  | { ok: false; message: string; code?: string };

export async function fetchOpsMetricsAction(args: {
  namespace: string;
  metric: string;
  period?: number;
  stat?: string;
  /** ISO 8601 — 기본 1시간 전 */
  from?: string;
  to?: string;
}): Promise<OpsMetricActionResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };

  const res = await fetchOpsMetrics({
    jwt,
    namespace: args.namespace,
    metric: args.metric,
    period: args.period ?? 300,      // 5분 granularity 기본
    stat: args.stat ?? "Average",
    from: args.from ?? new Date(Date.now() - 3600_000).toISOString(),
    to: args.to ?? new Date().toISOString(),
  });

  if (!res.ok) return { ok: false, code: res.code, message: res.message };
  return { ok: true, data: res.data };
}

// ── 공통 메트릭 preset ───────────────────────────────────────────────────
// ops/page.tsx 의 ObservabilityBlock 에서 preset 으로 호출.

export async function fetchCpuUtilizationAction(instanceId?: string): Promise<OpsMetricActionResult> {
  return fetchOpsMetricsAction({
    namespace: "AWS/EC2",
    metric: "CPUUtilization",
    stat: "Average",
    // 서버는 instanceId 를 query param 'dimensions' 로 받을 수 있음.
    from: new Date(Date.now() - 3600_000).toISOString(),
  });
}

export async function fetchAlbRequestCountAction(): Promise<OpsMetricActionResult> {
  return fetchOpsMetricsAction({
    namespace: "AWS/ApplicationELB",
    metric: "RequestCount",
    stat: "Sum",
    from: new Date(Date.now() - 3600_000).toISOString(),
  });
}

export async function fetchAlbTargetResponseTimeAction(): Promise<OpsMetricActionResult> {
  return fetchOpsMetricsAction({
    namespace: "AWS/ApplicationELB",
    metric: "TargetResponseTime",
    stat: "p95",
    from: new Date(Date.now() - 3600_000).toISOString(),
  });
}

export async function fetchRdsConnectionsAction(): Promise<OpsMetricActionResult> {
  return fetchOpsMetricsAction({
    namespace: "AWS/RDS",
    metric: "DatabaseConnections",
    stat: "Average",
    from: new Date(Date.now() - 3600_000).toISOString(),
  });
}
