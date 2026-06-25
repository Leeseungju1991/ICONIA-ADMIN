"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { PanelCard } from "../../_components/PanelCard";
import { AdminToast, useAdminToast } from "../../_components/AdminToast";
import {
  closeCircuitAction,
  invalidateCacheAction,
  setMaintenanceAction,
} from "@/lib/actions/opsControls";

// V1.0 — 장애 대응 runbook + 수동 운영 작업 인터페이스.
//
// 알람 → runbook 점프 (hash anchor). 각 항목에 대응 절차 + 관련 ops 액션 버튼.
// circuit close / cache invalidate / maintenance mode 는 Server endpoint 가
// 아직 미배포여도 graceful — 호출 시 "준비 중" 토스트.

const TWO_STEP_PHRASE = "EXECUTE";

function twoStepConfirm(label: string): boolean {
  if (typeof window === "undefined") return false;
  const v = window.prompt(
    `${label}\n\n강력 액션입니다. 실행하려면 정확히 "${TWO_STEP_PHRASE}" 를 입력하세요.`,
  );
  return v === TWO_STEP_PHRASE;
}

type Runbook = {
  /** URL hash anchor — 알람 본문 deep link 용. */
  anchor: string;
  alertKey: string;
  title: string;
  symptom: string;
  steps: string[];
  related: Array<{ href: string; label: string }>;
};

const RUNBOOKS: Runbook[] = [
  {
    anchor: "api-p95-spike",
    alertKey: "api.p95.global",
    title: "API p95 스파이크",
    symptom:
      "전체 API p95 가 임계치 (200~250ms) 를 5분 이상 초과. 일부 라우트에 집중 또는 광범위.",
    steps: [
      "SLO 대시보드에서 어느 ROUTE 가 원인인지 확인 (호출량 TOP + p95 컬럼).",
      "해당 ROUTE 의 최근 1시간 로그를 검색 (level=warn|error).",
      "DB / 외부 의존성 상태 확인. degraded 이면 dependency 별 runbook 참조.",
      "특정 라우트만 문제면: feature flag 로 비활성 또는 circuit breaker 강제 close.",
      "광범위 + Server 5xx 다발이면: 메인터넌스 모드 토글 검토 (10~30분).",
    ],
    related: [
      { href: "/dashboard/ops/slo", label: "SLO 대시보드" },
      { href: "/dashboard/ops/logs", label: "로그 검색" },
      { href: "/dashboard/ops", label: "운영 안정성 (feature flag · kill switch)" },
    ],
  },
  {
    anchor: "ai-fallback-spike",
    alertKey: "ai.fallback_rate",
    title: "AI fallback 비율 급증",
    symptom:
      "AI 호출 fallback 비율이 5분 동안 5% 이상. 외부 LLM 장애 또는 키 풀 cooldown.",
    steps: [
      "운영 안정성 → AI 호출 모니터링 패널에서 provider 분포 / 키 풀 상태 확인.",
      "fallback 사유 breakdown 으로 timeout/rate_limit/safety_block 분류.",
      "특정 provider 만 문제면: 가중치 임시 조정 (server 측 환경 변수).",
      "전체 provider 문제면: AI 페르소나의 cache 모드 켜기 또는 user-facing 안내 공지.",
    ],
    related: [
      { href: "/dashboard/ops", label: "AI 호출 모니터링" },
      { href: "/dashboard/personas", label: "페르소나 상태" },
      { href: "/dashboard/notices", label: "공지 작성" },
    ],
  },
  {
    anchor: "db-unreachable",
    alertKey: "db.unreachable",
    title: "DB 도달 불가",
    symptom:
      "DB primary 또는 replica probe 가 down. 운영 콘솔 자체도 정지될 수 있음.",
    steps: [
      "SLO 대시보드 → 외부 의존성 표에서 어느 DB 가 down 인지 확인.",
      "replica down 만이면: read traffic 을 primary 로 강제 (server env switch).",
      "primary down 이면: AWS RDS 콘솔 직접 확인 → failover 절차.",
      "회복 직후 캐시 invalidate (stale 키 제거).",
      "사용자 영향이 있었다면 사후 공지 작성.",
    ],
    related: [
      { href: "/dashboard/ops/slo", label: "의존성 상태" },
      { href: "/dashboard/notices", label: "공지 작성" },
    ],
  },
  {
    anchor: "deploy-failed",
    alertKey: "deploy_failed",
    title: "배포 실패 / 펌웨어 롤백 급증",
    symptom:
      "최근 OTA 배포의 실패 디바이스 비율이 임계치 초과. 또는 rollback 자동 트리거.",
    steps: [
      "OTA 관리 → 진행 중 배포의 실패 디바이스 코드별 분포 확인.",
      "동일 error_code 가 50% 이상이면: 배포 일시정지 (pause).",
      "근본원인이 펌웨어 버그면: 직전 stable 버전으로 rollback.",
      "리포트 archive 에 incident 노트 작성 (post-mortem).",
    ],
    related: [
      { href: "/dashboard/ota", label: "OTA 관리" },
      { href: "/dashboard/firmware-errors", label: "펌웨어 에러" },
      { href: "/dashboard/reports-archive", label: "리포트 archive" },
    ],
  },
  {
    anchor: "queue-buildup",
    alertKey: "queue.depth",
    title: "큐 적체 / DLQ 증가",
    symptom: "처리 대기 큐 깊이 증가 또는 DLQ 항목 급증.",
    steps: [
      "운영 안정성 → DLQ 탭에서 최근 실패 사유 확인.",
      "일과성 네트워크 에러면: bulk-retry (최대 50건).",
      "동일 페이로드 반복 실패면: payload 검사 후 skip 또는 수동 fix.",
      "처리량 부족이면: worker concurrency 일시 증설 (server env).",
    ],
    related: [
      { href: "/dashboard/ops", label: "DLQ 재처리 (운영 안정성)" },
    ],
  },
];

export default function OpsRunbookPage() {
  const { toast, setToast } = useAdminToast();
  return (
    <div className="space-y-6">
      <PanelCard
        title="장애 대응 runbook"
        description="장애 유형별 증상·대응 절차·관련 페이지를 제공합니다."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {RUNBOOKS.map((r) => (
            <Link
              key={r.anchor}
              href={`#${r.anchor}`}
              className="block rounded-xl border border-slate-200 bg-white px-3 py-3 hover:bg-slate-50 transition"
            >
              <div className="text-xs font-mono text-muted">{r.alertKey}</div>
              <div className="text-sm font-semibold text-slate-900 mt-0.5">
                {r.title}
              </div>
            </Link>
          ))}
        </div>
      </PanelCard>

      {RUNBOOKS.map((r) => (
        <section
          key={r.anchor}
          id={r.anchor}
          className="scroll-mt-24"
          aria-labelledby={`${r.anchor}-h`}
        >
          <PanelCard
            title={r.title}
            description={`알람 종류: ${r.alertKey}`}
          >
            <div className="space-y-3">
              <div>
                <div className="text-xs text-muted mb-1">증상</div>
                <div className="text-sm text-slate-700">{r.symptom}</div>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">대응 절차</div>
                <ol className="space-y-1.5 text-sm text-slate-700 list-decimal list-inside">
                  {r.steps.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
              <div>
                <div className="text-xs text-muted mb-1">관련 페이지</div>
                <div className="flex flex-wrap gap-2">
                  {r.related.map((rel) => (
                    <Link
                      key={rel.href}
                      href={rel.href}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                    >
                      {rel.label} →
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </PanelCard>
        </section>
      ))}

      <OpsControlsPanel onToast={setToast} />

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

function OpsControlsPanel({ onToast }: { onToast: (m: string) => void }) {
  const [circuitName, setCircuitName] = useState("");
  const [circuitReason, setCircuitReason] = useState("");
  const [cacheSelector, setCacheSelector] = useState("");
  const [cacheReason, setCacheReason] = useState("");
  const [maintEnabled, setMaintEnabled] = useState(false);
  const [maintReason, setMaintReason] = useState("");
  const [maintUntil, setMaintUntil] = useState("");

  const [busy, startBusy] = useTransition();

  function classifyOpsError(message: string): string {
    if (
      message.startsWith("ERR_NETWORK") ||
      message.startsWith("ERR_SERVER_UNAVAILABLE") ||
      message.includes("not_found") ||
      message.includes("Not Found")
    ) {
      return "준비 중 — Server endpoint 가 아직 배포되지 않았습니다.";
    }
    return message;
  }

  function handleCircuit() {
    if (!circuitName) return onToast("circuit breaker 이름을 입력하세요.");
    if (circuitReason.trim().length < 5)
      return onToast("사유는 5자 이상 입력하세요.");
    if (!twoStepConfirm(`Circuit breaker "${circuitName}" 를 강제 close 합니다.`))
      return;
    startBusy(async () => {
      const r = await closeCircuitAction({
        name: circuitName,
        reason: circuitReason.trim(),
      });
      if (!r.ok) {
        onToast(`실패: ${classifyOpsError(r.message)}`);
        return;
      }
      onToast(`circuit ${circuitName} → close 완료.`);
      setCircuitReason("");
    });
  }

  function handleCacheInvalidate() {
    if (!cacheSelector) return onToast("selector 를 입력하세요.");
    if (cacheReason.trim().length < 5)
      return onToast("사유는 5자 이상 입력하세요.");
    if (!twoStepConfirm(`캐시 "${cacheSelector}" 를 invalidate 합니다.`))
      return;
    startBusy(async () => {
      const r = await invalidateCacheAction({
        selector: cacheSelector,
        reason: cacheReason.trim(),
      });
      if (!r.ok) {
        onToast(`실패: ${classifyOpsError(r.message)}`);
        return;
      }
      onToast(`캐시 ${cacheSelector} invalidate 완료.`);
      setCacheReason("");
    });
  }

  function handleMaintenance() {
    if (maintReason.trim().length < 5)
      return onToast("사유는 5자 이상 입력하세요.");
    const label = maintEnabled
      ? "메인터넌스 모드 ON (사용자 트래픽 차단)"
      : "메인터넌스 모드 OFF (정상 운영 재개)";
    if (!twoStepConfirm(label)) return;
    startBusy(async () => {
      const r = await setMaintenanceAction({
        enabled: maintEnabled,
        reason: maintReason.trim(),
        until: maintUntil ? new Date(maintUntil).toISOString() : undefined,
      });
      if (!r.ok) {
        onToast(`실패: ${classifyOpsError(r.message)}`);
        return;
      }
      onToast(`메인터넌스 모드 = ${maintEnabled ? "ON" : "OFF"} 완료.`);
      setMaintReason("");
    });
  }

  return (
    <PanelCard
      title="수동 운영 작업"
      description="서킷 강제 차단·캐시 무효화·점검 모드 등 수동 작업입니다. 사유 5자 이상 입력과 2단계 확인이 필요하며 감사 로그에 기록됩니다."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-slate-900">
            Circuit breaker 강제 close
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={circuitName}
              onChange={(e) => setCircuitName(e.target.value)}
              placeholder="breaker 이름 (ai_service / wp_woo / sms)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              disabled={busy}
            />
            <input
              type="text"
              value={circuitReason}
              onChange={(e) => setCircuitReason(e.target.value)}
              placeholder="사유 5자 이상"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={busy}
            />
          </div>
          <button
            type="button"
            onClick={handleCircuit}
            disabled={busy}
            className="rounded-xl bg-rose-600 text-white text-sm px-4 py-2 disabled:opacity-40"
          >
            {busy ? "실행 중..." : "강제 close"}
          </button>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">캐시 invalidate</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              value={cacheSelector}
              onChange={(e) => setCacheSelector(e.target.value)}
              placeholder="selector (all / personas / commerce_products / terms_active)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
              disabled={busy}
            />
            <input
              type="text"
              value={cacheReason}
              onChange={(e) => setCacheReason(e.target.value)}
              placeholder="사유 5자 이상"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={busy}
            />
          </div>
          <button
            type="button"
            onClick={handleCacheInvalidate}
            disabled={busy}
            className="rounded-xl bg-slate-900 text-white text-sm px-4 py-2 disabled:opacity-40"
          >
            {busy ? "실행 중..." : "invalidate"}
          </button>
        </div>

        <div className="space-y-2 border-t border-slate-100 pt-4">
          <h3 className="text-sm font-semibold text-slate-900">
            메인터넌스 모드 토글
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={maintEnabled}
                onChange={(e) => setMaintEnabled(e.target.checked)}
                disabled={busy}
              />
              <span>메인터넌스 ON</span>
            </label>
            <input
              type="datetime-local"
              value={maintUntil}
              onChange={(e) => setMaintUntil(e.target.value)}
              placeholder="종료 예정 (선택)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={busy || !maintEnabled}
            />
            <input
              type="text"
              value={maintReason}
              onChange={(e) => setMaintReason(e.target.value)}
              placeholder="사유 5자 이상"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled={busy}
            />
          </div>
          <button
            type="button"
            onClick={handleMaintenance}
            disabled={busy}
            className="rounded-xl bg-amber-600 text-white text-sm px-4 py-2 disabled:opacity-40"
          >
            {busy ? "실행 중..." : "토글 실행"}
          </button>
          <p className="text-[11px] text-muted">
            ※ 메인터넌스 ON 시 사용자 트래픽은 503 + maintenance 페이지로 반환됨.
            운영자 콘솔은 영향 받지 않음. 켜기 직후 자동으로 사용자 공지 게시 (서버 옵션).
          </p>
        </div>
      </div>
    </PanelCard>
  );
}
