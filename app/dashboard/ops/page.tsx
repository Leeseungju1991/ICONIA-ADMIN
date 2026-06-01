"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { getAiHealthAction } from "@/lib/actions/aiHealth";
import type { AiHealthSnapshot, IncidentAlertRow } from "@/lib/adminApi";
import {
  listIncidentAlertsAction,
  ackIncidentAlertAction,
} from "@/lib/actions/alerts";
import {
  listDlqAction,
  bulkRetryDlqAction,
  type DlqListResult,
} from "@/lib/actions/dlq";
import type { DeadLetterRow as ServerDeadLetterRow } from "@/lib/adminApi";

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

const healthStatusLabel = (s: string): string => {
  switch (s) {
    case "ok": return "정상";
    case "degraded": return "저하";
    case "down": return "장애";
    default: return s;
  }
};

const dlqStatusLabel = (s: string): string => {
  switch (s) {
    case "pending": return "대기";
    case "queued": return "대기";
    case "processing": return "처리 중";
    case "failed": return "실패";
    case "resolved": return "해결됨";
    default: return s;
  }
};

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
      render: (r) => <span className={healthStatusChip(r.status)}>{healthStatusLabel(r.status)}</span>,
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
        title="① 서비스 상태 점검"
        description="서비스·지역별 상태를 확인합니다. 상세 추이는 통계 페이지에서 확인하세요."
      >
        <DataTable columns={columns} rows={probes} empty="probe 데이터가 없습니다." />
      </PanelCard>
    </>
  );
}

// ── 1-b) AI timeout / fallback 모니터링 ────────────────────────
// 출시준비 라운드 §7 — AI timeout monitoring (Gemini fallback rate · p95 · 504/429).
//
// 데이터 소스 — Server `GET /api/v1/admin/ai-health` 실 연동 (aiHealthTracker 5분
// sliding window). `getAiHealthAction()` server action 경유 — JWT 노출 차단.
//   - p50/p95/p99: tracker `latency_ms` (실측 AI 호출 latency).
//   - fallback rate: tracker `fallback_rate` (fallback_kind 가 붙은 호출 / 전체).
//   - 모델별 분해: tracker `by_model`.
// Server 도달 불가(network/5xx) 시 `mockHealthProbes` + `mockServerErrors` 로
// graceful degrade — 패널이 사라지지 않고 mock 배지를 노출한다.
function AiTimeoutBlock() {
  const [snapshot, setSnapshot] = useState<AiHealthSnapshot | null>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getAiHealthAction()
      .then((res) => {
        if (cancelled) return;
        if (res.ok) {
          setSnapshot(res.snapshot);
          setLive(true);
        } else {
          setLive(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // mock fallback 산출 — Server 미연동 환경에서의 근사값.
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
  const mockFallbackRate =
    totalServerErrors > 0 ? (aiTimeoutCount / totalServerErrors) * 100 : 0;

  // live 우선, 없으면 mock — 표시 값 단일화.
  const p95 = live && snapshot ? snapshot.latency_ms.p95 : aiProbe?.latency_p95_ms ?? 0;
  const p50 = live && snapshot ? snapshot.latency_ms.p50 : null;
  const p95Healthy = p95 <= 3000; // Gemini SLA 권고선 3,000ms.
  const fallbackRate =
    live && snapshot ? snapshot.fallback_rate * 100 : mockFallbackRate;
  const fallbackCount =
    live && snapshot ? snapshot.fallback_count : aiTimeoutCount;
  const windowTotal = live && snapshot ? snapshot.window_total : totalServerErrors;
  const callsLastMinute = live && snapshot ? snapshot.calls_last_minute : null;

  return (
    <PanelCard
      title="① -b AI 호출 모니터링 — 응답 시간·실패율"
      description={
        live
          ? "최근 5분 간 AI 호출의 실패율과 응답 속도를 표시합니다."
          : "AI 게이트웨이의 시간 초과·요청 제한 비율과 응답 속도를 확인합니다."
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={live ? "AI 호출 p95" : "ai-worker p95 (KR)"}
          value={`${p95.toLocaleString()}ms`}
          delta={p95Healthy ? "정상" : "임계 초과"}
          deltaTone={p95Healthy ? "up" : "down"}
          hint={
            p50 != null
              ? `p50 ${p50.toLocaleString()}ms · SLA ≤ 3,000ms`
              : "Gemini SLA ≤ 3,000ms"
          }
          accent={p95Healthy ? "blue" : "pink"}
        />
        <StatCard
          label={live ? "AI 호출 p99" : "persona p95"}
          value={
            live && snapshot
              ? `${snapshot.latency_ms.p99.toLocaleString()}ms`
              : `${personaProbe?.latency_p95_ms.toLocaleString() ?? "—"}ms`
          }
          hint={live ? "꼬리 latency — 타임아웃 위험" : "응답 합성 포함 e2e"}
          accent="teal"
        />
        <StatCard
          label="AI fallback rate"
          value={`${fallbackRate.toFixed(1)}%`}
          delta={`${fallbackCount.toLocaleString()}건 / ${windowTotal.toLocaleString()}`}
          deltaTone={fallbackRate > 10 ? "down" : "flat"}
          hint={live ? "fallback_kind 호출 / 전체 (5분)" : "timeout + rate-limit / 전 서버에러"}
          accent="orange"
        />
        <StatCard
          label={live ? "최근 1분 호출" : "마지막 fallback"}
          value={
            live && callsLastMinute != null
              ? `${callsLastMinute.toLocaleString()}건`
              : (() => {
                  const lastFallback = mockServerErrors
                    .filter((e) => e.service === "ai-worker")
                    .map((e) => e.last_seen)
                    .sort()
                    .at(-1);
                  return lastFallback ? formatDate(lastFallback) : "—";
                })()
          }
          hint={live ? "Gemini quota 근사 (분당 호출 수)" : "ai-worker 5xx 최근 발생"}
          accent="pink"
        />
      </div>
      {/* Phase 16 — context_compressed + key pool + provider distribution (Server 신규 필드). */}
      {live && snapshot ? (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {(() => {
            const cc = snapshot.context_compressed_count_5m ?? 0;
            const total = snapshot.window_total || 0;
            const ratio = total > 0 ? (cc / total) * 100 : 0;
            const high = ratio > 5;
            return (
              <div
                className={[
                  "rounded-2xl border px-4 py-3",
                  high ? "border-amber-200 bg-amber-50/80" : "border-white/60 bg-white/55",
                ].join(" ")}
              >
                <div className="text-xs text-muted">컨텍스트 압축 발동 (5m)</div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-xl font-bold text-slate-800">{cc.toLocaleString()}건</span>
                  <span className={["text-xs", high ? "text-amber-700" : "text-muted"].join(" ")}>
                    {ratio.toFixed(1)}% / 호출 {total.toLocaleString()}
                  </span>
                </div>
                <div className="text-[11px] text-muted mt-1">
                  Gemini ERR_CONTEXT_TOO_LONG 압축 재시도. 5% 초과 시 SOUL 캐시 압축 정책 점검.
                </div>
              </div>
            );
          })()}

          {(() => {
            const kp = snapshot.key_pool;
            if (!kp) {
              return (
                <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3">
                  <div className="text-xs text-muted">Gemini 키 풀</div>
                  <div className="mt-1 text-sm text-slate-700">단일 키 모드</div>
                  <div className="text-[11px] text-muted mt-1">
                    GEMINI_API_KEYS 다중 키 미설정. 폭주 시 fallback 카피로만 보호.
                  </div>
                </div>
              );
            }
            const allActive = kp.cooling_down === 0 && kp.disabled === 0;
            return (
              <div
                className={[
                  "rounded-2xl border px-4 py-3",
                  allActive
                    ? "border-emerald-200 bg-emerald-50/60"
                    : kp.active === 0
                      ? "border-rose-200 bg-rose-50/80"
                      : "border-amber-200 bg-amber-50/60",
                ].join(" ")}
              >
                <div className="text-xs text-muted">Gemini 키 풀</div>
                <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                  <span className="text-xl font-bold text-slate-800">
                    {kp.active}/{kp.total}
                  </span>
                  <span className="text-xs text-emerald-700">활성</span>
                  {kp.cooling_down > 0 ? (
                    <span className="text-xs text-amber-700">cooldown {kp.cooling_down}</span>
                  ) : null}
                  {kp.disabled > 0 ? (
                    <span className="text-xs text-rose-700">disabled {kp.disabled}</span>
                  ) : null}
                </div>
                <div className="text-[11px] text-muted mt-1">
                  429/auth 실패 시 자동 cooldown · 회복 시 자동 복귀. 키 평문은 노출되지 않음.
                </div>
              </div>
            );
          })()}

          {(() => {
            const pd = snapshot.provider_distribution_5m;
            if (!pd || Object.keys(pd).length === 0) {
              return (
                <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3">
                  <div className="text-xs text-muted">Provider 분포 (5m)</div>
                  <div className="mt-1 text-sm text-slate-700">집계 없음</div>
                  <div className="text-[11px] text-muted mt-1">
                    region 라우팅 활성 시 gemini / deepseek / vertex 호출 비율 표시.
                  </div>
                </div>
              );
            }
            const total = Object.values(pd).reduce((s, n) => s + n, 0);
            return (
              <div className="rounded-2xl border border-white/60 bg-white/55 px-4 py-3">
                <div className="text-xs text-muted">Provider 분포 (5m)</div>
                <div className="mt-1.5 space-y-1">
                  {Object.entries(pd)
                    .sort((a, b) => b[1] - a[1])
                    .map(([provider, n]) => {
                      const pct = total > 0 ? (n / total) * 100 : 0;
                      return (
                        <div key={provider} className="flex items-center gap-2 text-xs">
                          <span className="font-mono text-slate-700 w-16 truncate">{provider}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/60 overflow-hidden">
                            <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-muted w-20 text-right">
                            {n.toLocaleString()} · {pct.toFixed(0)}%
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            );
          })()}
        </div>
      ) : null}

      {live && snapshot && snapshot.by_model.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {snapshot.by_model.map((m) => (
            <span
              key={m.model}
              className="text-[11px] rounded-full bg-slate-100 px-2.5 py-1 text-slate-600"
            >
              {m.model}: {m.calls.toLocaleString()}회 · fallback {m.fallback_count} · avg{" "}
              {m.avg_latency_ms.toLocaleString()}ms
            </span>
          ))}
        </div>
      ) : null}
      {live && snapshot && snapshot.by_kind ? (
        <div className="mt-3">
          <div className="text-[11px] text-muted mb-1">응답 종류별 (V2.0 #13 — text / voice / vision)</div>
          <div className="flex flex-wrap gap-2">
            {(["text", "voice", "vision"] as const)
              .map((k) => ({ k, e: snapshot.by_kind?.[k] }))
              .filter((x) => x.e && x.e.total > 0)
              .map(({ k, e }) => (
                <span
                  key={k}
                  className="text-[11px] rounded-full bg-white/70 border border-white/70 px-2.5 py-1 text-slate-700"
                >
                  {k}: {e!.total}회 · success {(e!.success_rate * 100).toFixed(1)}% · fallback{" "}
                  {(e!.fallback_rate * 100).toFixed(1)}% · avg{" "}
                  {e!.latency_ms_avg.toLocaleString()}ms
                </span>
              ))}
          </div>
        </div>
      ) : null}
      {live && snapshot && snapshot.by_soul_catalog_id ? (
        <div className="mt-3">
          <div className="text-[11px] text-muted mb-1">SOUL 카탈로그별 (상위 5개)</div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(snapshot.by_soul_catalog_id)
              .filter(([, e]) => e.total > 0)
              .sort((a, b) => b[1].total - a[1].total)
              .slice(0, 5)
              .map(([soul, e]) => (
                <span
                  key={soul}
                  className="text-[11px] rounded-full bg-white/70 border border-white/70 px-2.5 py-1 text-slate-700"
                >
                  {soul}: {e.total}회 · fallback {(e.fallback_rate * 100).toFixed(1)}% · avg{" "}
                  {e.latency_ms_avg.toLocaleString()}ms
                </span>
              ))}
            {Object.values(snapshot.by_soul_catalog_id).every((e) => e.total === 0) ? (
              <span className="text-[11px] text-muted">집계 없음 (AI 서비스 재시작 직후일 수 있음)</span>
            ) : null}
          </div>
        </div>
      ) : null}
      <p className="text-[11px] text-muted mt-3">
        {live ? (
          <>※ 최근 5분 간의 실측 데이터를 표시합니다. 실패 사유·모델별 토큰 정보가 포함됩니다.</>
        ) : (
          <>※ 서버 미도달 상태로 근사값을 표시 중입니다. 연결이 복구되면 실측 데이터로 자동 전환됩니다.</>
        )}
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
  const [serverAlerts, setServerAlerts] = useState<IncidentAlertRow[] | null>(null);
  const [serverAlertsError, setServerAlertsError] = useState<string | null>(null);

  useEffect(() => {
    listIncidentAlertsAction({ status: "open", limit: 20 }).then((r) => {
      if (r.ok) {
        setServerAlerts(r.items);
      } else {
        setServerAlertsError(r.message);
      }
    });
  }, []);

  async function ackServerAlert(id: string) {
    const note = askReason("Server alert ack (5자 이상)");
    if (!note) {
      onToast("사유 5자 이상 필요.");
      return;
    }
    const r = await ackIncidentAlertAction({ id, note });
    if (!r.ok) {
      onToast(`ack 실패 (${r.code ?? "ERR"}): ${r.message}`);
      return;
    }
    setServerAlerts((prev) => (prev ? prev.filter((a) => a.id !== id) : prev));
    onToast(`Server alert ack 완료 — ${r.alert.kind}`);
    onRefreshAudit();
  }

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
      title="③ 활성 알람"
      description="임계치 도달 시 운영자에게 발송되는 알림입니다. 인앱 배너 진입점도 여기입니다."
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
      {/* V2.0 #12 — Server `/api/v1/admin/alerts` (Phase2-A) 실 wiring sub-section */}
      <div className="mt-5 rounded-2xl border border-white/60 bg-white/30 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Server IncidentAlert (open)</div>
          <span
            className={
              (serverAlerts?.length ?? 0) > 0 ? "chip chip-error" : "chip chip-success"
            }
          >
            {serverAlerts?.length ?? 0}건 open
          </span>
        </div>
        {serverAlertsError ? (
          <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
            Server `/api/v1/admin/alerts` 도달 실패: {serverAlertsError}
          </div>
        ) : serverAlerts === null ? (
          <div className="text-xs text-muted">불러오는 중</div>
        ) : serverAlerts.length === 0 ? (
          <div className="text-xs text-muted">현재 open 상태 IncidentAlert 가 없습니다.</div>
        ) : (
          <ul className="space-y-2">
            {serverAlerts.map((a) => (
              <li
                key={a.id}
                className="rounded-xl bg-white/55 border border-white/60 px-3 py-2 text-xs flex items-start justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={
                        a.severity === "critical"
                          ? "chip chip-error"
                          : a.severity === "warning"
                            ? "chip chip-warn"
                            : "chip chip-info"
                      }
                    >
                      {a.severity === "critical"
                        ? "긴급"
                        : a.severity === "warning"
                          ? "경고"
                          : "정보"}
                    </span>
                    <span className="chip chip-muted">{a.kind}</span>
                    <span className="text-muted">{a.source}</span>
                  </div>
                  <div className="mt-1 font-medium text-slate-800">{a.message}</div>
                  <div className="text-muted">opened {a.opened_at}</div>
                </div>
                <button
                  className="btn-outline text-xs shrink-0"
                  type="button"
                  onClick={() => ackServerAlert(a.id)}
                >
                  ack
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <p className="text-[11px] text-muted mt-3">
        ※ 아래 알람 영역에 임계치 초과 알람이 자동으로 표시됩니다.
      </p>
    </PanelCard>
  );
}

// ── 2) tracing ───────────────────────────────────────────────────
function TracingBlock() {
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<TraceEvent | null>(null);
  const [serverTrace, setServerTrace] = useState<{
    trace_id: string;
    hops: Array<{ at: string; hop_kind: string; source: string; payload: Record<string, unknown> }>;
  } | null>(null);
  const [serverTraceErr, setServerTraceErr] = useState<string | null>(null);
  const [traceQuery, setTraceQuery] = useState("");
  const [tracePending, startTraceTransition] = useTransition();

  async function runServerTraceLookup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setServerTrace(null);
    setServerTraceErr(null);
    const fd = new FormData(e.currentTarget);
    startTraceTransition(async () => {
      const { fetchAdminTraceAction } = await import("@/lib/actions/trace");
      const r = await fetchAdminTraceAction(fd);
      if (!r.ok) {
        setServerTraceErr(r.message);
        return;
      }
      setServerTrace({ trace_id: r.trace_id, hops: r.hops });
    });
  }

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
        title="② 요청 추적 — 종단 간 검색"
        description="앱·서버·AI·기기 사이의 요청 흐름을 한 번에 확인합니다. 행을 클릭하면 상세 데이터가 표시됩니다."
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
          ※ 상단은 예시 추적 시나리오(채팅 재시도 성공, 펌웨어 다운로드 실패)이고, 하단에서 실제 추적 ID 를 조회할 수 있습니다.
        </p>

        {/* V2.0 #9 — Server `/api/v1/admin/trace/:traceId` (Phase2-A) wiring sub-section */}
        <div className="mt-5 rounded-2xl border border-white/60 bg-white/30 p-3">
          <div className="text-sm font-semibold mb-2">Server trace 조회 (실 연동)</div>
          <form onSubmit={runServerTraceLookup} className="flex gap-2">
            <input
              type="text"
              name="trace_id"
              value={traceQuery}
              onChange={(e) => setTraceQuery(e.target.value)}
              placeholder="trace_id UUID 입력"
              className="flex-1 rounded-xl border border-white/70 bg-white/60 px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={tracePending || traceQuery.trim().length === 0}
              className="rounded-xl bg-accent px-3 py-2 text-xs text-white shadow-card disabled:opacity-60"
            >
              {tracePending ? "조회 중..." : "trace 조회"}
            </button>
          </form>
          {serverTraceErr ? (
            <div className="mt-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {serverTraceErr}
            </div>
          ) : null}
          {serverTrace ? (
            <div className="mt-3">
              <div className="text-xs mb-2">
                <span className="font-mono text-slate-700">{serverTrace.trace_id}</span>
                <span className="chip chip-muted ml-2">{serverTrace.hops.length} hops</span>
              </div>
              {serverTrace.hops.length === 0 ? (
                <div className="text-xs text-muted">hop 이 없습니다.</div>
              ) : (
                <ol className="space-y-1">
                  {serverTrace.hops.map((h, i) => (
                    <li
                      key={i}
                      className="rounded-xl bg-white/65 border border-white/50 px-3 py-2 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            h.hop_kind === "audit"
                              ? "chip chip-info"
                              : h.hop_kind === "firmware"
                                ? "chip chip-warn"
                                : "chip chip-muted"
                          }
                        >
                          {h.hop_kind}
                        </span>
                        <span className="font-mono text-slate-700">{h.source}</span>
                        <span className="text-muted ml-auto">{h.at}</span>
                      </div>
                      <details className="mt-1">
                        <summary className="cursor-pointer text-[11px] text-accent">payload</summary>
                        <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-white/80 p-2 text-[10px]">
                          {JSON.stringify(h.payload, null, 2)}
                        </pre>
                      </details>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}
        </div>
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
        title="⑤ 실패 큐 — 강제 재시도"
        description="자동 재시도가 모두 실패한 작업입니다. 내용을 확인하고 직접 재투입합니다."
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
          ※ 하단 sub-section 이 Server `/api/v1/admin/dead-letter` 정본 (enumerate + payload_summary + bulk-retry).
        </p>

        <LiveDlqSubPanel onToast={onToast} onRefreshAudit={onRefreshAudit} />
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

// Phase 9 #2 — Server `/api/v1/admin/dead-letter` 실 연동 + bulk-retry.
function LiveDlqSubPanel({
  onToast,
  onRefreshAudit,
}: {
  onToast: (msg: string) => void;
  onRefreshAudit: () => void;
}) {
  const [items, setItems] = useState<ServerDeadLetterRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPending, startBulk] = useTransition();

  async function reload() {
    setLoading(true);
    setError(null);
    const r: DlqListResult = await listDlqAction({ status: "pending", limit: 50 });
    if (!r.ok) {
      setError(r.message);
      setItems(null);
    } else {
      setItems(r.items);
    }
    setLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    if (!items) return;
    setSelected(new Set(items.slice(0, 50).map((i) => i.id)));
  }
  function clearAll() {
    setSelected(new Set());
  }

  function runBulk() {
    if (selected.size === 0) {
      onToast("재처리할 항목을 선택하세요.");
      return;
    }
    const reason = askReason("DLQ 일괄 재처리");
    if (!reason) {
      onToast("사유가 5자 이상 필요합니다.");
      return;
    }
    startBulk(async () => {
      const r = await bulkRetryDlqAction({ ids: Array.from(selected) });
      if (!r.ok) {
        onToast(`bulk-retry 실패 (${r.code ?? "ERR"}): ${r.message}`);
        return;
      }
      onToast(
        `bulk-retry 완료: 요청 ${r.data.requested} · 성공 ${r.data.succeeded} · 실패 ${r.data.failed}`,
      );
      clearAll();
      reload();
      onRefreshAudit();
    });
  }

  return (
    <div className="mt-5 rounded-2xl border border-white/60 bg-white/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-semibold">Server DLQ (실 연동)</div>
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={selectAll}
            disabled={!items || items.length === 0}
            className="rounded-lg bg-white/70 border border-white/70 px-2 py-1 disabled:opacity-50"
          >
            전체 선택
          </button>
          <button
            type="button"
            onClick={clearAll}
            disabled={selected.size === 0}
            className="rounded-lg bg-white/70 border border-white/70 px-2 py-1 disabled:opacity-50"
          >
            선택 해제
          </button>
          <button
            type="button"
            onClick={runBulk}
            disabled={selected.size === 0 || bulkPending}
            className="rounded-lg bg-accent px-3 py-1 text-white disabled:opacity-50"
          >
            {bulkPending ? "재처리 중..." : `bulk-retry (${selected.size})`}
          </button>
        </div>
      </div>
      {loading ? (
        <div className="text-xs text-muted">불러오는 중</div>
      ) : error ? (
        <div className="text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
          Server 도달 실패: {error}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="text-xs text-muted">pending DLQ 가 비어 있습니다.</div>
      ) : (
        <ul className="space-y-1">
          {items.map((d) => (
            <li
              key={d.id}
              className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-xs"
            >
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(d.id)}
                  onChange={() => toggle(d.id)}
                  className="h-3.5 w-3.5"
                />
                <span className="font-mono">{d.event_id}</span>
                <span className="chip chip-warn">{dlqStatusLabel(d.status)}</span>
                <span className="text-muted">attempts {d.attempts}</span>
                {d.last_error_code ? (
                  <span className="ml-auto text-amber-700 font-mono">{d.last_error_code}</span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
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
      title="⑥ 긴급 복구 액션"
      description="펌웨어 롤백·페르소나 회수·푸시 재발송·기기 초기화·강제 로그아웃 등 즉시 실행 기능입니다. 강력 액션은 사유 입력과 2단계 확인이 필요합니다."
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
      title="⑧ 긴급 차단 — 전역·지역 기능 차단"
      description="활성화 시 즉시 차단됩니다. 사유 입력과 2단계 확인이 필요합니다."
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
        description="기능 활성 여부와 노출 비율을 설정합니다. 변경 시 사유 입력이 필요합니다."
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
      title="④ 운영자 활동 로그 — 이번 세션"
      description="이번 세션에서 수행한 모든 운영자 액션이 표시됩니다."
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
