"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { OpsAuditTrailPanel } from "../_components/OpsAuditTrailPanel";
import { mockPush, formatDate, type PushRow } from "@/lib/mockData";
import { mockOpsActions, OPS_KIND_LABEL } from "@/lib/mockOpsActions";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";

const audienceLabel: Record<PushRow["audience"], string> = {
  all: "전체",
  premium: "프리미엄",
  owners: "인형 보유자",
  inactive_7d: "7일 미접속",
};

const stateInfo: Record<PushRow["state"], { label: string; chip: string }> = {
  draft: { label: "임시저장", chip: "chip chip-muted" },
  scheduled: { label: "예약됨", chip: "chip chip-info" },
  sending: { label: "발송 중", chip: "chip chip-warn" },
  sent: { label: "발송완료", chip: "chip chip-success" },
  failed: { label: "실패", chip: "chip chip-error" },
};

export default function PushPage() {
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState<PushRow | null>(null);
  const [stateFilter, setStateFilter] = useState<"all" | PushRow["state"]>("all");
  const [auditTick, setAuditTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  async function runRetry(target_id: string, target_label: string) {
    const reason = window.prompt("푸시 재발송 사유 (5자 이상, 감사 로그에 기록).");
    if (!reason || reason.trim().length < 5) {
      setToast("사유가 5자 이상 필요합니다.");
      return;
    }
    // 일시 실패는 silent retry — 운영자 액션이므로 transient 실패를 노출하지 않는다.
    const result = await recordOpsAuditWithSilentRetry({
      action: "push.retry",
      target_label,
      target_id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "queued",
    });
    setAuditTick((t) => t + 1);
    if (result.ok) {
      setToast(`푸시 재발송을 audit trail 에 기록했습니다. (대상: ${target_label})`);
    } else {
      setToast(
        `푸시 재발송 큐 적재 최종 실패 — 운영자 확인 필요. (대상: ${target_label}) [${result.attempts}회 시도]`,
      );
    }
  }

  const failedPushOps = mockOpsActions.filter(
    (a) => a.kind === "push_send" && (a.status === "failed" || a.status === "queued"),
  );

  const filtered = useMemo(
    () => mockPush.filter((p) => stateFilter === "all" || p.state === stateFilter),
    [stateFilter],
  );

  const summary = useMemo(() => {
    const sent = mockPush.filter((p) => p.state === "sent");
    const delivered = sent.reduce((s, p) => s + p.delivered, 0);
    const opened = sent.reduce((s, p) => s + p.opened, 0);
    const openRate = delivered > 0 ? `${((opened / delivered) * 100).toFixed(1)}%` : "—";
    const scheduled = mockPush.filter((p) => p.state === "scheduled").length;
    return { delivered, opened, openRate, scheduled };
  }, []);

  // 출시준비 라운드 §10 — Expo Push delivery 성공률 · invalidated 토큰.
  // 데이터 모델:
  //   - delivery_success_rate = delivered / total (캠페인 완료된 것)
  //   - invalidated_tokens   = total - delivered (APNs/FCM 측 무효 토큰 + 기기 제거)
  //   - 실패 캠페인 (state==="failed") 카운트
  // 백엔드 연동 시 `/api/v1/admin/push/expo-receipts` (DeviceNotRegistered / InvalidCredentials
  // / MessageRateExceeded 분류) 로 교체.
  const deliveryHealth = useMemo(() => {
    const sent = mockPush.filter((p) => p.state === "sent");
    const total = sent.reduce((s, p) => s + p.total, 0);
    const delivered = sent.reduce((s, p) => s + p.delivered, 0);
    const successRate = total > 0 ? (delivered / total) * 100 : 0;
    const invalidated = Math.max(0, total - delivered);
    const failedCampaigns = mockPush.filter((p) => p.state === "failed").length;
    return { total, delivered, successRate, invalidated, failedCampaigns };
  }, []);

  const columns: Column<PushRow>[] = [
    { key: "title", header: "제목", render: (r) => <span className="font-medium text-slate-800">{r.title}</span> },
    { key: "audience", header: "대상", render: (r) => <span className="chip chip-info">{audienceLabel[r.audience]}</span> },
    { key: "state", header: "상태", render: (r) => <span className={stateInfo[r.state].chip}>{stateInfo[r.state].label}</span> },
    { key: "schedule", header: "예약 시각", render: (r) => <span className="text-xs text-muted">{formatDate(r.scheduled_at)}</span> },
    { key: "sent", header: "발송 시각", render: (r) => <span className="text-xs text-muted">{r.sent_at ? formatDate(r.sent_at) : "—"}</span> },
    { key: "delivered", header: "도달", align: "right", render: (r) => r.delivered.toLocaleString() },
    {
      key: "open",
      header: "오픈율",
      align: "right",
      render: (r) => {
        if (r.delivered === 0) return "—";
        const pct = (r.opened / r.delivered) * 100;
        return `${pct.toFixed(1)}%`;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button
            className="btn-outline text-xs"
            type="button"
            onClick={() => setEditing({ ...r, id: "", state: "draft", sent_at: null })}
          >
            복사
          </button>
          {r.state === "draft" || r.state === "scheduled" ? (
            <button
              className="btn-outline text-xs"
              type="button"
              onClick={() => setEditing(r)}
            >
              편집
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="총 도달 (완료된 캠페인)" value={summary.delivered.toLocaleString()} hint="누적" accent="blue" />
        <StatCard label="총 오픈" value={summary.opened.toLocaleString()} hint="누적" accent="pink" />
        <StatCard label="평균 오픈율" value={summary.openRate} hint="발송 완료 평균" accent="purple" />
        <StatCard label="예약된 캠페인" value={String(summary.scheduled)} hint="대기 중" accent="teal" />
      </section>

      {/* 출시준비 라운드 §10 — Expo Push delivery 성공률 · invalidated 토큰. */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Push 성공률"
          value={`${deliveryHealth.successRate.toFixed(1)}%`}
          delta={deliveryHealth.successRate >= 95 ? "정상" : "주의"}
          deltaTone={deliveryHealth.successRate >= 95 ? "up" : "down"}
          hint={`${deliveryHealth.delivered.toLocaleString()} / ${deliveryHealth.total.toLocaleString()}`}
          accent={deliveryHealth.successRate >= 95 ? "teal" : "pink"}
        />
        <StatCard
          label="Invalidated 토큰"
          value={deliveryHealth.invalidated.toLocaleString()}
          delta={`${
            deliveryHealth.total > 0
              ? ((deliveryHealth.invalidated / deliveryHealth.total) * 100).toFixed(1)
              : "0"
          }%`}
          deltaTone="flat"
          hint="DeviceNotRegistered / InvalidCredentials"
          accent="pink"
        />
        <StatCard
          label="실패 캠페인"
          value={String(deliveryHealth.failedCampaigns)}
          hint="state===failed (재발송 패널 참조)"
          accent="orange"
        />
        <StatCard
          label="Expo Receipts"
          value="미연동"
          delta="자리만 확보"
          deltaTone="flat"
          hint="`/api/v1/admin/push/expo-receipts`"
          accent="blue"
        />
      </section>

      <PanelCard
        title="푸시 캠페인"
        description="앱 푸시 알림 캠페인을 작성·예약·발송하고 결과를 모니터링합니다."
        actions={
          <>
            <select
              className="select max-w-[160px]"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)}
            >
              <option value="all">전체 상태</option>
              <option value="draft">임시저장</option>
              <option value="scheduled">예약됨</option>
              <option value="sending">발송 중</option>
              <option value="sent">완료</option>
              <option value="failed">실패</option>
            </select>
            <button className="btn-primary text-sm" type="button" onClick={() => setComposing(true)}>
              + 새 캠페인
            </button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="해당 상태의 캠페인이 없습니다." />
      </PanelCard>

      <PanelCard
        title="실패한 푸시 발송"
        description="APNs/FCM 발송 실패 또는 대기 중 캠페인. 재발송 시 세션 audit trail 에 기록."
      >
        {failedPushOps.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">실패한 푸시 발송이 없습니다.</div>
        ) : (
          <ul className="space-y-2">
            {failedPushOps.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl bg-white/55 border border-white/60 px-4 py-3 text-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={r.status === "failed" ? "chip chip-error" : "chip chip-info"}>
                      {r.status === "failed" ? "실패" : "대기"}
                    </span>
                    <span className="chip chip-muted">{OPS_KIND_LABEL[r.kind]}</span>
                    <span className="font-mono text-xs text-slate-700 truncate max-w-[220px]">
                      {r.target_label}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted mt-1">
                    {r.failure_reason ?? "대기 중"} · 재시도 {r.retry_count}회
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    className="btn-outline text-xs"
                    type="button"
                    onClick={() => runRetry(r.target_id, r.target_label)}
                  >
                    재발송
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <OpsAuditTrailPanel
        prefix="push."
        title="푸시 운영자 액션 audit (세션)"
        description="재발송·캠페인 취소 등 운영자 액션 기록. 백엔드 연동 후 Server audit_log 와 머지."
        refresh={{ tick: auditTick }}
      />

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card">
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">
            닫기
          </button>
        </div>
      ) : null}

      {composing ? (
        <PushComposer
          onClose={() => setComposing(false)}
          onSubmit={(msg) => {
            setComposing(false);
            setToast(msg);
          }}
        />
      ) : null}
      {editing ? (
        <PushComposer
          source={editing}
          onClose={() => setEditing(null)}
          onSubmit={(msg) => {
            setEditing(null);
            setToast(msg);
          }}
        />
      ) : null}
    </div>
  );
}

// PushComposer — 신규 작성 / 편집 / 복사 겸용. source 가 있으면 초기값 채움.
function PushComposer({
  source,
  onClose,
  onSubmit,
}: {
  source?: PushRow;
  onClose: () => void;
  onSubmit: (toastMessage: string) => void;
}) {
  const isEdit = Boolean(source?.id);
  const [title, setTitle] = useState(source?.title ?? "");
  const [body, setBody] = useState(source?.body ?? "");
  const [audience, setAudience] = useState<PushRow["audience"]>(source?.audience ?? "all");
  const [scheduledAt, setScheduledAt] = useState(
    source?.scheduled_at ? source.scheduled_at.slice(0, 16) : "",
  );
  const [error, setError] = useState<string | null>(null);

  function validate(): boolean {
    if (!title.trim()) {
      setError("제목을 입력하세요.");
      return false;
    }
    if (!body.trim()) {
      setError("본문을 입력하세요.");
      return false;
    }
    setError(null);
    return true;
  }

  function saveDraft() {
    if (!validate()) return;
    // TODO(server-wire-up): `/api/v1/admin/push` POST (state=draft).
    onSubmit(`"${title.trim()}" 임시저장 요청을 기록했습니다. (백엔드 연동 후 저장)`);
  }

  function schedule() {
    if (!validate()) return;
    if (!scheduledAt) {
      setError("예약 발송은 예약 시각이 필요합니다.");
      return;
    }
    // TODO(server-wire-up): `/api/v1/admin/push` POST (state=scheduled).
    onSubmit(
      `"${title.trim()}" ${isEdit ? "수정" : "예약"} 요청을 기록했습니다. (대상: ${audienceLabel[audience]} · 백엔드 연동 후 발송)`,
    );
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
        <h3 className="text-lg font-bold text-slate-900">
          {isEdit ? "푸시 캠페인 편집" : "새 푸시 캠페인"}
        </h3>

        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-600">제목
            <input
              className="input mt-1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="알림 제목"
              maxLength={50}
            />
          </label>
          <label className="block text-xs text-slate-600">본문
            <textarea
              className="input mt-1 min-h-[100px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="알림 본문"
              maxLength={200}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-600">대상
              <select
                className="select mt-1"
                value={audience}
                onChange={(e) => setAudience(e.target.value as PushRow["audience"])}
              >
                <option value="all">전체</option>
                <option value="premium">프리미엄</option>
                <option value="owners">인형 보유자</option>
                <option value="inactive_7d">7일 미접속</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">예약 시각
              <input
                className="input mt-1"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </label>
          </div>

          <div className="rounded-2xl bg-white/55 border border-white/60 p-3">
            <div className="text-xs text-muted mb-2">📱 미리보기</div>
            <div className="rounded-xl bg-slate-900/85 text-white p-3 text-sm">
              <div className="text-[11px] text-white/70">ICONIA</div>
              <div className="font-semibold">{title || "알림 제목"}</div>
              <div className="text-xs text-white/85">{body || "알림 본문이 표시됩니다."}</div>
            </div>
          </div>
          {error ? (
            <p className="text-xs text-rose-600 bg-rose-50/80 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose}>취소</button>
          <button className="btn-outline text-sm" type="button" onClick={saveDraft}>임시저장</button>
          <button className="btn-primary text-sm" type="button" onClick={schedule}>
            {isEdit ? "예약 수정" : "예약 발송"}
          </button>
        </div>
      </div>
    </div>
  );
}
