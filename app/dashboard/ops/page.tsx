"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { OpsAuditTrailPanel } from "../_components/OpsAuditTrailPanel";
import {
  mockHealthProbes,
  mockOpsAlerts,
  mockTraces,
  mockDeadLetters,
  mockKillSwitches,
  mockFeatureFlags,
  RECOVERY_ACTIONS,
  RECOVERY_ACTION_KIND_LIST,
  severityChip,
  healthStatusChip,
  hopChip,
  type HealthProbeRow,
  type OpsAlertRow,
  type TraceEvent,
  type DeadLetterRow,
  type KillSwitchState,
  type FeatureFlagRow,
  type RecoveryActionKind,
} from "@/lib/opsInfraMock";
import {
  mockUserPerceivedErrorRate,
  USER_PERCEIVED_ERROR_SLO_TARGET,
  formatDate,
  mockServerErrors,
} from "@/lib/mockData";
import { lookupErrorCode, operatorLabelForCode } from "@/lib/errorCatalog";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";
import { recordOperatorAuditAction } from "@/lib/actions/auditLog";

// 운영 안정성 9항목 통합 표면 — Round 3 (2026-05-20).
//
// 본 페이지는 다음 항목을 단일 표면에 통합:
//   1. observability      — health probe / SLO 게이지 / 알람 카드
//   2. tracing            — trace_id 검색 + drawer raw payload
//   3. alerting           — 알람 패널 (in-app banner + slack/email 표시)
//   4. audit log          — server canonical + 세션 trail
//   5. replay tool        — dead-letter 큐 + payload preview + 재투입
//   6. recovery action    — OTA 롤백·persona 회수·push 재발송·device reset·force logout
//   7. force retry        — dead-letter 강제 재시도 (silent retry 미흡 케이스)
//   8. kill switch        — 전역/지역 기능 차단 (사유 + 2단계 확인)
//   9. feature flag       — 캠페인/단계적 배포 토글
//
// 모든 운영자 액션은 `opsAuditTrail` 또는 `recordOperatorAuditAction` 로 audit 기록.
// 강력 액션(kill switch / 일부 recovery)은 사유 입력 + 2단계 확인 prompt.

const OPERATOR = "(현재 운영자 세션)";
const TWO_STEP_PHRASE = "EXECUTE";

function twoStepConfirm(label: string): boolean {
  if (typeof window === "undefined") return false;
  const phrase = window.prompt(
    `${label}\n\n강력 액션입니다. 실행하려면 정확히 "${TWO_STEP_PHRASE}" 를 입력하세요.`,
  );
  return phrase === TWO_STEP_PHRASE;
}

function askReason(label: string): string | null {
  if (typeof window === "undefined") return null;
  const reason = window.prompt(`${label} 사유를 입력하세요 (감사 로그에 기록됩니다, 5자 이상).`);
  if (!reason || reason.trim().length < 5) return null;
  return reason.trim();
}

export default function OpsPage() {
  const [toast, setToast] = useState<string | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  const refreshAudit = () => setAuditTick((t) => t + 1);

  return (
    <div className="space-y-6">
      <ObservabilityBlock />
      <AiTimeoutBlock />
      <AlertingBlock onToast={setToast} onRefreshAudit={refreshAudit} />
      <TracingBlock />
      <ReplayBlock onToast={setToast} onRefreshAudit={refreshAudit} />
      <RecoveryActionsBlock onToast={setToast} onRefreshAudit={refreshAudit} />
      <KillSwitchBlock onToast={setToast} onRefreshAudit={refreshAudit} />
      <FeatureFlagBlock onToast={setToast} onRefreshAudit={refreshAudit} />
      <AuditLogBlock auditTick={auditTick} />

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card max-w-md">
          {toast}
          <button
            className="ml-3 underline opacity-80"
            type="button"
            onClick={() => setToast(null)}
          >
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}

// ── 1) observability ─────────────────────────────────────────────
function ObservabilityBlock() {
  const probes = mockHealthProbes;
  const slo = mockUserPerceivedErrorRate.at(-1)!;
  const todayRate =
    slo.total_errors > 0 ? slo.user_visible / slo.total_errors : 0;
  const meeting = todayRate <= USER_PERCEIVED_ERROR_SLO_TARGET;

  const ok = probes.filter((p) => p.status === "ok").length;
  const degraded = probes.filter((p) => p.status === "degraded").length;
  const down = probes.filter((p) => p.status === "down").length;

  const columns: Column<HealthProbeRow>[] = [
    {
      key: "service",
      header: "서비스",
      render: (r) => <span className="font-mono text-sm text-slate-800">{r.service}</span>,
    },
    {
      key: "region",
      header: "리전",
      render: (r) => <span className="chip chip-muted">{r.region}</span>,
    },
    {
      key: "status",
      header: "상태",
      render: (r) => <span className={healthStatusChip(r.status)}>{r.status}</span>,
    },
    {
      key: "p50",
      header: "p50",
      align: "right",
      render: (r) => <span className="text-xs">{r.latency_p50_ms}ms</span>,
    },
    {
      key: "p95",
      header: "p95",
      align: "right",
      render: (r) => <span className="text-xs">{r.latency_p95_ms}ms</span>,
    },
    {
      key: "err",
      header: "에러율",
      align: "right",
      render: (r) => (
        <span className={r.error_rate_pct > 1 ? "text-rose-600" : "text-slate-700"}>
          {r.error_rate_pct.toFixed(2)}%
        </span>
      ),
    },
    {
      key: "checked",
      header: "마지막 probe",
      render: (r) => <span className="text-xs text-muted">{formatDate(r.checked_at)}</span>,
    },
  ];

  return (
    <>
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Probe OK"
          value={String(ok)}
          delta={`${probes.length} 중`}
          deltaTone="up"
          hint="현재 정상"
          accent="teal"
        />
        <StatCard
          label="Probe degraded"
          value={String(degraded)}
          hint="응답 지연 / 부분 실패"
          accent="orange"
        />
        <StatCard
          label="Probe down"
          value={String(down)}
          hint="긴급 대응 필요"
          accent="pink"
        />
        <StatCard
          label="사용자 인지 에러율 (오늘)"
          value={`${(todayRate * 100).toFixed(2)}%`}
          delta={meeting ? "SLO 충족" : "SLO 위반"}
          deltaTone={meeting ? "up" : "down"}
          hint={`목표 ≤ ${(USER_PERCEIVED_ERROR_SLO_TARGET * 100).toFixed(1)}%`}
          accent={meeting ? "blue" : "pink"}
        />
      </section>

      <PanelCard
        title="① observability — 서비스 헬스 probe"
        description="서비스·리전별 health probe (mock — 백엔드 미연동). 자세한 SLO 시계열은 /dashboard/stats 참조."
      >
        <DataTable columns={columns} rows={probes} empty="probe 데이터가 없습니다." />
      </PanelCard>
    </>
  );
}

// ── 1-b) AI timeout / fallback 모니터링 ────────────────────────
// 출시준비 라운드 §7 — AI timeout monitoring (Gemini fallback rate · p95 · 504/429).
// 데이터 소스:
//   - p50/p95: health probe 의 ai-worker / persona 값.
//   - fallback rate: 서버 에러 중 GEMINI_GATEWAY_TIMEOUT + GEMINI_RATE_LIMITED 합 / 총.
//   - 마지막 fallback 발생 시각: ai-worker 5xx 의 last_seen.
// 백엔드 연동 시 `/api/v1/admin/ops/ai-health` (미정) 시계열로 교체.
function AiTimeoutBlock() {
  const aiProbe = mockHealthProbes.find(
    (p) => p.service === "ai-worker" && p.region === "KR",
  );
  const personaProbe = mockHealthProbes.find(
    (p) => p.service === "persona" && p.region === "KR",
  );

  const aiTimeoutCount = mockServerErrors
    .filter((e) => e.path.includes("/persona") || e.service === "ai-worker")
    .reduce((s, e) => s + e.count, 0);
  const totalServerErrors = mockServerErrors.reduce((s, e) => s + e.count, 0);
  const fallbackRate =
    totalServerErrors > 0 ? (aiTimeoutCount / totalServerErrors) * 100 : 0;

  const lastFallback =
    mockServerErrors
      .filter((e) => e.service === "ai-worker")
      .map((e) => e.last_seen)
      .sort()
      .at(-1) ?? null;

  const p95 = aiProbe?.latency_p95_ms ?? 0;
  // p95 임계 — Gemini SLA 권고선 3,000ms. 초과 시 warn.
  const p95Healthy = p95 <= 3000;

  return (
    <PanelCard
      title="① -b AI 호출 모니터링 — timeout · fallback · p95"
      description="Gemini gateway timeout / rate-limit 비율과 ai-worker p95 latency. Bedrock fallback flag 와 함께 운영."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="ai-worker p95 (KR)"
          value={`${p95.toLocaleString()}ms`}
          delta={p95Healthy ? "정상" : "임계 초과"}
          deltaTone={p95Healthy ? "up" : "down"}
          hint="Gemini SLA ≤ 3,000ms"
          accent={p95Healthy ? "blue" : "pink"}
        />
        <StatCard
          label="persona p95"
          value={`${personaProbe?.latency_p95_ms.toLocaleString() ?? "—"}ms`}
          hint="응답 합성 포함 e2e"
          accent="teal"
        />
        <StatCard
          label="AI fallback rate"
          value={`${fallbackRate.toFixed(1)}%`}
          delta={`${aiTimeoutCount.toLocaleString()}건`}
          deltaTone={fallbackRate > 30 ? "down" : "flat"}
          hint="timeout + rate-limit / 전 서버에러"
          accent="orange"
        />
        <StatCard
          label="마지막 fallback"
          value={lastFallback ? formatDate(lastFallback) : "—"}
          hint="ai-worker 5xx 최근 발생"
          accent="pink"
        />
      </div>
      <p className="text-[11px] text-muted mt-3">
        ※ 백엔드 미연동 — fallback rate 는 `mockServerErrors` 기반. `/api/v1/admin/ops/ai-health`
        도입 후 Gemini timeout / 429 / Bedrock fallback 적중률을 별도 카운터로 노출. feature flag
        `ai.bedrock_fallback` 활성 여부와 연동 표시.
      </p>
    </PanelCard>
  );
}

// ── 3) alerting ──────────────────────────────────────────────────
function AlertingBlock({
  onToast,
  onRefreshAudit,
}: {
  onToast: (msg: string) => void;
  onRefreshAudit: () => void;
}) {
  const [alerts, setAlerts] = useState(mockOpsAlerts);

  async function ackAlert(id: string) {
    const reason = askReason("알람 확인(ack)");
    if (!reason) {
      onToast("사유가 5자 이상 필요합니다.");
      return;
    }
    const alert = alerts.find((a) => a.id === id);
    if (!alert) return;
    const result = await recordOpsAuditWithSilentRetry({
      action: "ops.alert_ack",
      target_label: alert.title,
      target_id: id,
      reason,
      operator: OPERATOR,
      outcome: "queued",
    });
    onRefreshAudit();
    if (result.ok) {
      setAlerts((prev) =>
        prev.map((a) =>
          a.id === id ? { ...a, acked_by: OPERATOR, resolved_at: new Date().toISOString() } : a,
        ),
      );
      onToast(`알람 ack 완료. (${alert.title})`);
    } else {
      onToast(`알람 ack 큐 적재 최종 실패 — [${result.attempts}회 시도]`);
    }
  }

  const active = alerts.filter((a) => !a.resolved_at);
  const resolved = alerts.filter((a) => a.resolved_at);

  return (
    <PanelCard
      title="③ alerting — 활성 알람"
      description="임계 도달 시 운영자에게 발송되는 in-app / Slack / email 알람. 본 패널이 in-app banner 의 단일 진입점."
      actions={
        <span className={active.length > 0 ? "chip chip-error" : "chip chip-success"}>
          활성 {active.length} · 진정 {resolved.length}
        </span>
      }
    >
      {alerts.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted">알람이 없습니다.</div>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="rounded-2xl bg-white/55 border border-white/60 px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={severityChip(a.severity)}>{a.severity}</span>
                  <span className="chip chip-muted">{a.source}</span>
                  {a.channels.map((ch) => (
                    <span key={ch} className="chip chip-info">
                      {ch}
                    </span>
                  ))}
                  {a.acked_by ? <span className="chip chip-success">ack</span> : null}
                </div>
                <div className="mt-1 font-semibold text-slate-800">{a.title}</div>
                <div className="text-[11px] text-muted truncate">{a.body}</div>
                <div className="text-[11px] text-muted mt-0.5">
                  발생 {formatDate(a.fired_at)}
                  {a.resolved_at ? ` · 진정 ${formatDate(a.resolved_at)}` : ""}
                  {a.acked_by ? ` · ${a.acked_by}` : ""}
                </div>
              </div>
              {!a.resolved_at ? (
                <button
                  className="btn-outline text-xs shrink-0"
                  type="button"
                  onClick={() => ackAlert(a.id)}
                >
                  ack
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-muted mt-3">
        ※ 백엔드 미연동 — `/api/v1/admin/ops/alerts` 도입 후 실시간 stream 으로 교체. Slack webhook
        등은 표시만 (실 발송은 Server CloudWatch alarm 측).
      </p>
    </PanelCard>
  );
}

// ── 2) tracing ───────────────────────────────────────────────────
function TracingBlock() {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<TraceEvent | null>(null);

  const filtered = useMemo(() => {
    if (!q) return mockTraces;
    const s = q.toLowerCase();
    return mockTraces.filter(
      (t) =>
        t.trace_id.toLowerCase().includes(s) ||
        t.request_id.toLowerCase().includes(s) ||
        t.endpoint.toLowerCase().includes(s),
    );
  }, [q]);

  const groups = useMemo(() => {
    const map = new Map<string, TraceEvent[]>();
    for (const t of filtered) {
      const arr = map.get(t.trace_id) ?? [];
      arr.push(t);
      map.set(t.trace_id, arr);
    }
    return Array.from(map.entries()).map(([trace_id, hops]) => ({
      trace_id,
      hops: hops.sort((a, b) => a.started_at.localeCompare(b.started_at)),
    }));
  }, [filtered]);

  return (
    <>
      <PanelCard
        title="② tracing — trace_id / request_id 종단간 검색"
        description="App → Server → AI → Firmware 의 단일 trace 흐름. 행 클릭 시 raw payload preview."
        actions={
          <input
            className="input max-w-[260px]"
            placeholder="trace_id / request_id / endpoint 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        }
      >
        {groups.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">해당 trace 가 없습니다.</div>
        ) : (
          <div className="space-y-3">
            {groups.map((g) => (
              <div key={g.trace_id} className="rounded-2xl bg-white/55 border border-white/60 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-sm font-semibold text-slate-800">
                    {g.trace_id}
                  </span>
                  <span className="chip chip-muted">{g.hops.length} hops</span>
                  <span className="text-[11px] text-muted ml-auto">
                    {formatDate(g.hops[0].started_at)} → {formatDate(g.hops.at(-1)!.started_at)}
                  </span>
                </div>
                <ul className="space-y-1">
                  {g.hops.map((h) => (
                    <li
                      key={h.id}
                      className="flex items-center gap-2 rounded-xl bg-white/65 border border-white/50 px-3 py-2 text-xs hover:bg-white/80 cursor-pointer"
                      onClick={() => setPicked(h)}
                    >
                      <span className={hopChip(h.hop)}>{h.hop}</span>
                      <span className="font-mono text-slate-700 truncate flex-1">{h.endpoint}</span>
                      <span className={h.status === "error" ? "chip chip-error" : "chip chip-success"}>
                        {h.status}
                      </span>
                      <span className="text-muted">{h.duration_ms}ms</span>
                      <span className="font-mono text-[10px] text-muted">{h.request_id}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        <p className="text-[11px] text-muted mt-3">
          ※ 백엔드 미연동 — `/api/v1/admin/ops/traces?trace_id=` 도입 후 실 OTel/Jaeger backend
          연결. 현 mock 은 단일 trace 시나리오 2종 (chat happy → retry 성공, OTA 다운로드 실패).
        </p>
      </PanelCard>

      {picked ? <TracePayloadDrawer event={picked} onClose={() => setPicked(null)} /> : null}
    </>
  );
}

function TracePayloadDrawer({ event, onClose }: { event: TraceEvent; onClose: () => void }) {
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
        <h3 className="text-lg font-bold text-slate-900">Trace hop 상세</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{event.trace_id}</p>

        <dl className="mt-4 space-y-2 text-sm">
          <DRow k="request_id" v={<span className="font-mono">{event.request_id}</span>} />
          <DRow k="hop" v={<span className={hopChip(event.hop)}>{event.hop}</span>} />
          <DRow
            k="status"
            v={
              <span className={event.status === "error" ? "chip chip-error" : "chip chip-success"}>
                {event.status}
              </span>
            }
          />
          <DRow k="duration" v={`${event.duration_ms}ms`} />
          <DRow k="시작" v={<span className="text-xs">{formatDate(event.started_at)}</span>} />
          <DRow k="endpoint" v={<span className="font-mono text-xs">{event.endpoint}</span>} />
        </dl>

        <div className="mt-4 rounded-xl bg-slate-900/90 text-emerald-100 p-3 text-[11px] font-mono whitespace-pre-wrap break-all">
          {event.payload_preview}
        </div>
        <p className="text-[11px] text-muted mt-2">
          ※ raw payload 는 운영자 표시용 마스킹 미리보기. 풀 payload 는 Server 측 audit_logs 의
          metadata 참조 (백엔드 연동 후).
        </p>
      </div>
    </div>
  );
}

// ── 5) replay tool + 7) force retry ────────────────────────────
function ReplayBlock({
  onToast,
  onRefreshAudit,
}: {
  onToast: (msg: string) => void;
  onRefreshAudit: () => void;
}) {
  const [picked, setPicked] = useState<DeadLetterRow | null>(null);
  const [filter, setFilter] = useState<"all" | DeadLetterRow["queue"]>("all");

  const rows = useMemo(
    () => mockDeadLetters.filter((d) => filter === "all" || d.queue === filter),
    [filter],
  );

  async function forceReplay(row: DeadLetterRow) {
    const code = row.failure_code;
    const entry = lookupErrorCode(code);
    if (!entry.retryable) {
      onToast(`${code} (${entry.label}) 는 자동 재시도 불가. 수동 점검 필요.`);
      return;
    }
    const reason = askReason("강제 재투입");
    if (!reason) {
      onToast("사유가 5자 이상 필요합니다.");
      return;
    }
    const result = await recordOpsAuditWithSilentRetry({
      action: "ops.replay_force",
      target_label: `${row.queue} · ${operatorLabelForCode(code)}`,
      target_id: row.id,
      reason,
      operator: OPERATOR,
      outcome: "queued",
    });
    onRefreshAudit();
    if (result.ok) {
      onToast(`${row.id} 재투입 큐 적재 완료. (${row.queue})`);
    } else {
      onToast(`${row.id} 재투입 최종 실패 — 운영자 확인 필요. [${result.attempts}회 시도]`);
    }
  }

  const columns: Column<DeadLetterRow>[] = [
    {
      key: "queue",
      header: "큐",
      render: (r) => <span className="chip chip-muted">{r.queue}</span>,
    },
    {
      key: "code",
      header: "실패 코드",
      render: (r) => (
        <span className="font-mono text-xs text-slate-800">{operatorLabelForCode(r.failure_code)}</span>
      ),
    },
    {
      key: "retry",
      header: "큐 retry",
      align: "right",
      render: (r) => <span className="text-xs">{r.retry_count}</span>,
    },
    {
      key: "size",
      header: "payload",
      align: "right",
      render: (r) => <span className="text-xs text-muted">{r.payload_bytes.toLocaleString()} B</span>,
    },
    {
      key: "enq",
      header: "적재",
      render: (r) => <span className="text-xs text-muted">{formatDate(r.enqueued_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button className="btn-outline text-xs" type="button" onClick={() => setPicked(r)}>
            상세
          </button>
          <button className="btn-primary text-xs" type="button" onClick={() => forceReplay(r)}>
            강제 재시도
          </button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PanelCard
        title="⑤ replay tool · ⑦ force retry — dead-letter 큐"
        description="silent retry 가 모두 소진된 dead-letter. 운영자가 payload 를 검증하고 강제 재투입."
        actions={
          <select
            className="select max-w-[160px]"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">전체 큐</option>
            <option value="billing-webhook">billing-webhook</option>
            <option value="push">push</option>
            <option value="ai-task">ai-task</option>
            <option value="ota-callback">ota-callback</option>
          </select>
        }
      >
        <DataTable columns={columns} rows={rows} empty="dead-letter 큐가 비어 있습니다." />
        <p className="text-[11px] text-muted mt-3">
          ※ 백엔드 미연동 — `/api/v1/admin/ops/dead-letters` 도입 후 실 SQS DLQ 와 연결. retryable=false
          인 코드는 강제 재시도 차단.
        </p>
      </PanelCard>

      {picked ? (
        <DeadLetterDrawer
          row={picked}
          onClose={() => setPicked(null)}
          onForceReplay={() => {
            const r = picked;
            setPicked(null);
            forceReplay(r);
          }}
        />
      ) : null}
    </>
  );
}

function DeadLetterDrawer({
  row,
  onClose,
  onForceReplay,
}: {
  row: DeadLetterRow;
  onClose: () => void;
  onForceReplay: () => void;
}) {
  const entry = lookupErrorCode(row.failure_code);
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
        <h3 className="text-lg font-bold text-slate-900">Dead-letter 상세</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{row.id}</p>

        <dl className="mt-4 space-y-2 text-sm">
          <DRow k="큐" v={<span className="chip chip-muted">{row.queue}</span>} />
          <DRow k="실패 코드" v={<span className="font-mono text-xs">{row.failure_code}</span>} />
          <DRow k="운영자 라벨" v={entry.label} />
          <DRow k="권장 조치" v={<span className="text-xs">{entry.recommendedAction}</span>} />
          <DRow k="자동 재시도" v={entry.retryable ? "가능" : "불가 (수동 점검)"} />
          <DRow k="큐 retry" v={`${row.retry_count}회`} />
          <DRow k="페이로드" v={`${row.payload_bytes.toLocaleString()} B`} />
          <DRow k="최초 적재" v={<span className="text-xs">{formatDate(row.enqueued_at)}</span>} />
          <DRow k="최근 시도" v={<span className="text-xs">{formatDate(row.last_attempt_at)}</span>} />
        </dl>

        <div className="mt-4 rounded-xl bg-slate-900/90 text-emerald-100 p-3 text-[11px] font-mono whitespace-pre-wrap break-all">
          {row.payload_preview}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose}>
            닫기
          </button>
          <button
            className="btn-primary text-sm disabled:opacity-60"
            type="button"
            disabled={!entry.retryable}
            onClick={onForceReplay}
          >
            강제 재시도
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 6) recovery actions ────────────────────────────────────────
function RecoveryActionsBlock({
  onToast,
  onRefreshAudit,
}: {
  onToast: (msg: string) => void;
  onRefreshAudit: () => void;
}) {
  async function runRecovery(kind: RecoveryActionKind) {
    const meta = RECOVERY_ACTIONS[kind];
    if (meta.destructive && !twoStepConfirm(meta.label)) {
      onToast(`${meta.label} 실행 취소 — 확인 문구 불일치.`);
      return;
    }
    const reason = askReason(meta.label);
    if (!reason) {
      onToast("사유가 5자 이상 필요합니다.");
      return;
    }
    // user.* 액션은 server canonical audit; 그 외는 세션 trail.
    if (kind === "user.force_logout_all") {
      const res = await recordOperatorAuditAction({
        action: "user.force_logout",
        targetUserId: "(다중)",
        reasonText: reason,
      });
      onRefreshAudit();
      if (res.status === "error") {
        onToast(`${meta.label} 실패 — 감사 로그 차단 (${res.code ?? "ERR"})`);
        return;
      }
      onToast(`${meta.label} 요청을 server audit 에 기록했습니다. (백엔드 mutation 후속)`);
      return;
    }
    const result = await recordOpsAuditWithSilentRetry({
      action: `recovery.${kind}`,
      target_label: meta.label,
      target_id: kind,
      reason,
      operator: OPERATOR,
      outcome: "queued",
    });
    onRefreshAudit();
    if (result.ok) {
      onToast(`${meta.label} 요청을 audit trail 에 기록했습니다.`);
    } else {
      onToast(`${meta.label} 최종 실패 — [${result.attempts}회 시도]`);
    }
  }

  return (
    <PanelCard
      title="⑥ admin recovery actions — 즉시 실행 복구 액션"
      description="OTA 롤백 · Persona 회수 · Push 재발송 · 디바이스 reset · 사용자 강제 logout. 강력 액션은 사유 + 2단계 확인 (EXECUTE) 필수."
    >
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {RECOVERY_ACTION_KIND_LIST.map((kind) => {
          const meta = RECOVERY_ACTIONS[kind];
          return (
            <li
              key={kind}
              className="rounded-2xl bg-white/55 border border-white/60 p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-800">{meta.label}</span>
                {meta.destructive ? <span className="chip chip-error">destructive</span> : null}
                <span className="ml-auto font-mono text-[10px] text-muted">{kind}</span>
              </div>
              <p className="text-xs text-muted">{meta.description}</p>
              <div className="text-[11px] text-muted">
                마지막 실행: {meta.last_invoked_at ? formatDate(meta.last_invoked_at) : "—"}
              </div>
              <button
                className={meta.destructive ? "btn-danger text-sm mt-1" : "btn-outline text-sm mt-1"}
                type="button"
                onClick={() => runRecovery(kind)}
              >
                실행
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11px] text-muted mt-3">
        ※ 백엔드 미연동 — `/api/v1/admin/ops/recovery/{`<kind>`}` 도입 후 실제 mutation. user.* 는
        Server canonical audit (`recordOperatorAuditAction`), 그 외는 세션 trail.
      </p>
    </PanelCard>
  );
}

// ── 8) kill switch ─────────────────────────────────────────────
function KillSwitchBlock({
  onToast,
  onRefreshAudit,
}: {
  onToast: (msg: string) => void;
  onRefreshAudit: () => void;
}) {
  const [switches, setSwitches] = useState<KillSwitchState[]>(mockKillSwitches);

  async function toggle(idx: number) {
    const sw = switches[idx];
    const nextEnabled = !sw.enabled;
    if (!twoStepConfirm(`${sw.label} ${nextEnabled ? "활성화 (전역 차단 ON)" : "해제"}`)) {
      onToast(`${sw.label} 토글 취소 — 확인 문구 불일치.`);
      return;
    }
    const reason = askReason(sw.label);
    if (!reason) {
      onToast("사유가 5자 이상 필요합니다.");
      return;
    }
    const result = await recordOpsAuditWithSilentRetry({
      action: `kill_switch.${nextEnabled ? "enable" : "disable"}`,
      target_label: `${sw.label} (${sw.scope})`,
      target_id: sw.kind,
      reason,
      operator: OPERATOR,
      outcome: "queued",
    });
    onRefreshAudit();
    if (result.ok) {
      setSwitches((prev) =>
        prev.map((s, i) =>
          i === idx
            ? {
                ...s,
                enabled: nextEnabled,
                last_toggled_at: new Date().toISOString(),
                last_toggled_by: OPERATOR,
                last_reason: reason,
              }
            : s,
        ),
      );
      onToast(`${sw.label} ${nextEnabled ? "차단 활성화" : "해제"} — audit 기록 완료.`);
    } else {
      onToast(`${sw.label} 토글 최종 실패 — [${result.attempts}회 시도]`);
    }
  }

  return (
    <PanelCard
      title="⑧ kill switch — 전역/지역 기능 차단"
      description="강력 액션 — 사유 + 2단계 확인(EXECUTE) 필수. 활성화 시 즉시 차단. 백엔드 미연동 — UI 상태만 변경."
      actions={
        <span className={switches.some((s) => s.enabled) ? "chip chip-error" : "chip chip-muted"}>
          활성 {switches.filter((s) => s.enabled).length} / {switches.length}
        </span>
      }
    >
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {switches.map((sw, i) => (
          <li
            key={sw.kind}
            className={[
              "rounded-2xl border p-4 flex flex-col gap-2",
              sw.enabled
                ? "bg-rose-50/80 border-rose-200"
                : "bg-white/55 border-white/60",
            ].join(" ")}
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-slate-800">{sw.label}</span>
              <span className="chip chip-muted">{sw.scope}</span>
              {sw.enabled ? (
                <span className="chip chip-error">차단 ON</span>
              ) : (
                <span className="chip chip-success">정상</span>
              )}
              <span className="ml-auto font-mono text-[10px] text-muted">{sw.kind}</span>
            </div>
            <p className="text-xs text-muted">{sw.description}</p>
            {sw.last_toggled_at ? (
              <div className="text-[11px] text-muted">
                최근 토글 {formatDate(sw.last_toggled_at)} · {sw.last_toggled_by} · 사유:{" "}
                <span className="text-slate-700">{sw.last_reason ?? "—"}</span>
              </div>
            ) : (
              <div className="text-[11px] text-muted">최근 토글 기록 없음</div>
            )}
            <button
              className={sw.enabled ? "btn-outline text-sm mt-1" : "btn-danger text-sm mt-1"}
              type="button"
              onClick={() => toggle(i)}
            >
              {sw.enabled ? "차단 해제" : "차단 활성화"}
            </button>
          </li>
        ))}
      </ul>
    </PanelCard>
  );
}

// ── 9) feature flag ────────────────────────────────────────────
function FeatureFlagBlock({
  onToast,
  onRefreshAudit,
}: {
  onToast: (msg: string) => void;
  onRefreshAudit: () => void;
}) {
  const [flags, setFlags] = useState<FeatureFlagRow[]>(mockFeatureFlags);
  const [editing, setEditing] = useState<FeatureFlagRow | null>(null);

  async function applyEdit(updated: FeatureFlagRow, reason: string) {
    const original = flags.find((f) => f.key === updated.key);
    if (!original) return;
    const result = await recordOpsAuditWithSilentRetry({
      action: "feature_flag.update",
      target_label: `${updated.key} (${updated.rollout_pct}% / ${updated.enabled ? "ON" : "OFF"})`,
      target_id: updated.key,
      reason,
      operator: OPERATOR,
      outcome: "queued",
    });
    onRefreshAudit();
    if (result.ok) {
      setFlags((prev) =>
        prev.map((f) =>
          f.key === updated.key
            ? { ...updated, updated_at: new Date().toISOString(), updated_by: OPERATOR }
            : f,
        ),
      );
      onToast(`${updated.key} 갱신 완료. (${updated.enabled ? "ON" : "OFF"} · ${updated.rollout_pct}%)`);
    } else {
      onToast(`${updated.key} 갱신 최종 실패 — [${result.attempts}회 시도]`);
    }
    setEditing(null);
  }

  return (
    <>
      <PanelCard
        title="⑨ feature flag — 캠페인 / 실험 / 단계적 배포"
        description="활성 ON/OFF + 단계적 노출 비율 (0~100%). 갱신 시 사유 입력 필수."
      >
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {flags.map((f) => (
            <li
              key={f.key}
              className="rounded-2xl bg-white/55 border border-white/60 p-4 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-slate-800">{f.label}</span>
                {f.enabled ? (
                  <span className="chip chip-success">ON</span>
                ) : (
                  <span className="chip chip-muted">OFF</span>
                )}
                <span className="chip chip-info">{f.audience}</span>
                <span className="ml-auto font-mono text-[10px] text-muted">{f.key}</span>
              </div>
              <p className="text-xs text-muted">{f.description}</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 rounded-full bg-white/60 overflow-hidden">
                  <div className="h-full bg-accent" style={{ width: `${f.rollout_pct}%` }} />
                </div>
                <span className="text-xs text-slate-700 w-10 text-right">{f.rollout_pct}%</span>
              </div>
              <div className="text-[11px] text-muted">
                최근 갱신 {formatDate(f.updated_at)} · {f.updated_by ?? "—"}
              </div>
              <button
                className="btn-outline text-sm mt-1"
                type="button"
                onClick={() => setEditing(f)}
              >
                편집
              </button>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-muted mt-3">
          ※ 백엔드 미연동 — `/api/v1/admin/ops/feature-flags` 도입 후 실 LaunchDarkly/in-house store
          와 연결. 모든 변경은 audit 기록.
        </p>
      </PanelCard>

      {editing ? (
        <FeatureFlagEditModal
          flag={editing}
          onClose={() => setEditing(null)}
          onApply={applyEdit}
          onToast={onToast}
        />
      ) : null}
    </>
  );
}

function FeatureFlagEditModal({
  flag,
  onClose,
  onApply,
  onToast,
}: {
  flag: FeatureFlagRow;
  onClose: () => void;
  onApply: (next: FeatureFlagRow, reason: string) => void;
  onToast: (msg: string) => void;
}) {
  const [enabled, setEnabled] = useState(flag.enabled);
  const [rollout, setRollout] = useState(flag.rollout_pct);

  function submit() {
    const reason = askReason(`${flag.label} 갱신`);
    if (!reason) {
      onToast("사유가 5자 이상 필요합니다.");
      return;
    }
    onApply({ ...flag, enabled, rollout_pct: Math.max(0, Math.min(100, rollout)) }, reason);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/30">
      <div className="w-full max-w-lg glass-panel rounded-3xl p-6 relative">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">Feature flag 편집</h3>
        <p className="text-xs text-muted font-mono">{flag.key}</p>
        <p className="text-xs text-muted mt-1">{flag.description}</p>

        <div className="mt-5 space-y-3">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            활성화 (ON)
          </label>
          <label className="block text-xs text-slate-600">
            노출 비율 ({rollout}%)
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={rollout}
              onChange={(e) => setRollout(Number(e.target.value))}
              className="w-full mt-2"
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose}>
            취소
          </button>
          <button className="btn-primary text-sm" type="button" onClick={submit}>
            저장 (사유 입력)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 4) audit log ───────────────────────────────────────────────
function AuditLogBlock({ auditTick }: { auditTick: number }) {
  return (
    <OpsAuditTrailPanel
      prefix=""
      title="④ audit log — 본 세션 운영자 액션"
      description="모든 운영자 액션의 단일 패널 (ops.*, recovery.*, kill_switch.*, feature_flag.*). 백엔드 연동 후 Server audit_log 와 머지."
      refresh={{ tick: auditTick }}
    />
  );
}

function DRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="text-sm text-slate-800 font-medium">{v}</dd>
    </div>
  );
}
