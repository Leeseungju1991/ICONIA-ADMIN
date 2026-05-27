"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { PanelCard } from "../../_components/PanelCard";
import {
  getAlertConfigAction,
  updateAlertRuleAction,
} from "@/lib/actions/alertConfig";
import type {
  AlertConfig,
  AlertRuleRow,
  AlertChannelKind,
} from "@/lib/adminApi";

// V1.0 — 알람 설정 UI.
//
// Server `/api/v1/admin/alerts/config` (GET) + `/api/v1/admin/alerts/config/:key` (PATCH).
// SRE_OR_ABOVE. 변경은 사유 5자 이상 + Server audit_log.

function classifyError(message: string): {
  message: string;
  unreachable: boolean;
} {
  const unreachable =
    message.startsWith("ERR_NETWORK") ||
    message.startsWith("ERR_SERVER_UNAVAILABLE") ||
    message.includes("not_found") ||
    message.includes("Not Found");
  return { message, unreachable };
}

const UNIT_LABEL: Record<AlertRuleRow["unit"], string> = {
  ms: "ms",
  rate: "비율",
  count: "건",
  bool: "on/off",
};

const CHANNEL_LABEL: Record<AlertChannelKind, string> = {
  email: "이메일",
  slack: "슬랙",
  webhook: "webhook",
};

const ALL_CHANNELS: AlertChannelKind[] = ["email", "slack", "webhook"];

export default function OpsAlertsPage() {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [error, setError] = useState<{
    message: string;
    unreachable: boolean;
  } | null>(null);
  const [loading, startLoad] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  const reload = useCallback(() => {
    startLoad(async () => {
      const r = await getAlertConfigAction();
      if (!r.ok) {
        setError(classifyError(r.message));
        setConfig(null);
      } else {
        setError(null);
        setConfig(r.data);
      }
    });
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="space-y-6">
      <PanelCard
        title="알림 채널"
        description="알람 발생 시 메시지를 보낼 채널. 임계치별로 채널을 선택해 발송."
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
            <PreparingNotice endpoint="/api/v1/admin/alerts/config" />
          ) : (
            <ErrorNotice message={error.message} />
          )
        ) : !config ? (
          <div className="py-8 text-center text-xs text-muted">로딩 중...</div>
        ) : config.channels.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            등록된 알림 채널이 없습니다. (Server channels 비어 있음)
          </div>
        ) : (
          <ul className="space-y-2">
            {config.channels.map((ch, idx) => (
              <li
                key={`${ch.kind}-${idx}`}
                className="rounded-xl border border-slate-200 bg-white px-3 py-3 flex items-center justify-between gap-3"
              >
                <div>
                  <div className="text-sm font-semibold text-slate-900">
                    {CHANNEL_LABEL[ch.kind]}
                  </div>
                  <div className="text-[11px] text-muted font-mono">
                    {ch.target_masked}
                  </div>
                </div>
                <span
                  className={ch.enabled ? "chip chip-success" : "chip chip-info"}
                >
                  {ch.enabled ? "활성" : "비활성"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title="임계치 규칙"
        description="각 규칙은 SLO 위반 시 트리거. 임계치 / 활성화 / 채널 변경은 사유 5자 + audit_log."
      >
        {error ? (
          error.unreachable ? (
            <PreparingNotice endpoint="/api/v1/admin/alerts/config" />
          ) : (
            <ErrorNotice message={error.message} />
          )
        ) : !config ? (
          <div className="py-8 text-center text-xs text-muted">로딩 중...</div>
        ) : config.rules.length === 0 ? (
          <div className="py-8 text-center text-xs text-muted">
            정의된 임계치 규칙이 없습니다.
          </div>
        ) : (
          <ul className="space-y-3">
            {config.rules.map((rule) => (
              <AlertRuleEditor
                key={rule.key}
                rule={rule}
                onSaved={() => {
                  setToast(`규칙 ${rule.key} 변경 완료.`);
                  reload();
                }}
                onError={(msg) => setToast(`변경 실패: ${msg}`)}
              />
            ))}
          </ul>
        )}
      </PanelCard>

      <PanelCard
        title="관련 페이지"
        description="알람이 발생하면 점프할 페이지."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <Link
            href="/dashboard/ops/runbook"
            className="block rounded-xl border border-slate-200 bg-white px-3 py-3 hover:bg-slate-50 transition"
          >
            <div className="text-sm font-semibold text-slate-900">
              장애 대응 runbook
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              알람별 대응 절차 모음. 알람에서 클릭 시 점프.
            </div>
          </Link>
          <Link
            href="/dashboard/ops/slo"
            className="block rounded-xl border border-slate-200 bg-white px-3 py-3 hover:bg-slate-50 transition"
          >
            <div className="text-sm font-semibold text-slate-900">
              SLO 대시보드
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              현재 p95 / error rate / AI fallback 확인.
            </div>
          </Link>
          <Link
            href="/dashboard/ops"
            className="block rounded-xl border border-slate-200 bg-white px-3 py-3 hover:bg-slate-50 transition"
          >
            <div className="text-sm font-semibold text-slate-900">
              인시던트 큐
            </div>
            <div className="text-[11px] text-muted mt-0.5">
              열린 알람 ack / close (운영 안정성 통합 화면).
            </div>
          </Link>
        </div>
      </PanelCard>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card max-w-md">
          {toast}
          <button
            className="ml-3 underline opacity-80"
            onClick={() => setToast(null)}
            type="button"
          >
            닫기
          </button>
        </div>
      ) : null}
    </div>
  );
}

function AlertRuleEditor({
  rule,
  onSaved,
  onError,
}: {
  rule: AlertRuleRow;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [threshold, setThreshold] = useState(String(rule.threshold));
  const [enabled, setEnabled] = useState(rule.enabled);
  const [channels, setChannels] = useState<AlertChannelKind[]>(rule.channels);
  const [reason, setReason] = useState("");
  const [saving, startSave] = useTransition();

  const dirty =
    String(rule.threshold) !== threshold.trim() ||
    rule.enabled !== enabled ||
    rule.channels.join(",") !== channels.join(",");

  function toggleChannel(c: AlertChannelKind) {
    setChannels((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c].sort(),
    );
  }

  function handleSave() {
    if (reason.trim().length < 5) {
      onError("사유 5자 이상 필요");
      return;
    }
    const num = Number(threshold);
    if (!Number.isFinite(num)) {
      onError("임계치는 숫자여야 합니다.");
      return;
    }
    startSave(async () => {
      const r = await updateAlertRuleAction({
        key: rule.key,
        threshold: num,
        enabled,
        channels,
        reason: reason.trim(),
      });
      if (!r.ok) {
        onError(r.message);
        return;
      }
      setReason("");
      onSaved();
    });
  }

  return (
    <li className="rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-slate-700">{rule.key}</span>
            <span className="chip chip-info text-[10px]">
              단위: {UNIT_LABEL[rule.unit]}
            </span>
            {!rule.enabled ? (
              <span className="chip chip-warn text-[10px]">비활성</span>
            ) : null}
          </div>
          <div className="text-sm font-semibold text-slate-900 mt-1">
            {rule.label}
          </div>
          {rule.note ? (
            <div className="text-[11px] text-muted mt-0.5">{rule.note}</div>
          ) : null}
        </div>
        <div className="text-right text-[11px] text-muted shrink-0">
          마지막 수정: {new Date(rule.updated_at).toLocaleString("ko-KR")}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block">
          <span className="block text-xs text-muted mb-1">임계치</span>
          <input
            type="text"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            disabled={saving}
          />
        </label>
        <label className="flex items-center gap-2 mt-5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            disabled={saving}
          />
          <span className="text-sm text-slate-700">규칙 활성화</span>
        </label>
      </div>

      <div className="mt-3">
        <span className="block text-xs text-muted mb-1">알림 채널</span>
        <div className="flex items-center gap-3 flex-wrap">
          {ALL_CHANNELS.map((c) => (
            <label key={c} className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={channels.includes(c)}
                onChange={() => toggleChannel(c)}
                disabled={saving}
              />
              <span className="text-xs text-slate-700">{CHANNEL_LABEL[c]}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-end gap-3">
        <label className="block flex-1">
          <span className="block text-xs text-muted mb-1">
            변경 사유 (5자 이상, 필수)
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="예: p95 임계 200→250 완화 (대량 트래픽 진입)"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            disabled={saving || !dirty}
          />
        </label>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !dirty}
          className="rounded-xl bg-slate-900 text-white text-sm px-4 py-2 disabled:opacity-40 shrink-0"
        >
          {saving ? "저장 중..." : "변경 저장"}
        </button>
      </div>
    </li>
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
