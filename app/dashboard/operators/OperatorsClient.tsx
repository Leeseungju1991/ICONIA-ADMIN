"use client";

import { useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { OpsAuditTrailPanel } from "../_components/OpsAuditTrailPanel";
import { formatDate } from "@/lib/mockData";
import { maskEmail } from "@/lib/maskPii";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";
import {
  ALL_ROLES,
  ROLE_LABEL,
  type OperatorRole,
} from "@/lib/operatorRoles";
import type { OperatorRow } from "@/lib/adminApi";
import {
  disableOperatorAction,
  type ListOperatorsResult,
} from "@/lib/actions/operators";

// 역할 칩 색상 — Sidebar RoleBadge 와 동일 시각 언어.
const roleChip: Record<string, string> = {
  superadmin: "chip chip-error",
  sre: "chip chip-info",
  secops: "chip chip-info",
  cs: "chip chip-success",
  viewer: "chip chip-muted",
};

function roleLabel(role: string): string {
  return (ROLE_LABEL as Record<string, string>)[role] ?? (role || "(미지정)");
}

const TWO_STEP_PHRASE = "EXECUTE";

export default function OperatorsClient({
  initial,
  currentOperatorId,
  currentOperatorEmail,
}: {
  initial: ListOperatorsResult;
  currentOperatorId: string | null;
  currentOperatorEmail: string | null;
}) {
  const [operators, setOperators] = useState<OperatorRow[]>(
    initial.ok ? initial.operators : [],
  );
  const [loadError] = useState<string | null>(initial.ok ? null : initial.message);
  const [toast, setToast] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [auditTick, setAuditTick] = useState(0);
  const [isPending, startTransition] = useTransition();
  // 비활성화 처리 결과를 세션 내 로컬 상태로 반영 (server action 성공 후 즉시 UI 갱신).
  const [disabledOverrides, setDisabledOverrides] = useState<Record<string, string>>({});

  const rows = useMemo(
    () =>
      operators.map((op) => ({
        ...op,
        disabled_at: disabledOverrides[op.id] ?? op.disabled_at,
      })),
    [operators, disabledOverrides],
  );

  const summary = useMemo(() => {
    const active = rows.filter((o) => !o.disabled_at).length;
    const disabled = rows.filter((o) => o.disabled_at).length;
    const superadmins = rows.filter((o) => o.role === "superadmin" && !o.disabled_at).length;
    const noTotp = rows.filter((o) => !o.totp_enrolled && !o.disabled_at).length;
    return { active, disabled, superadmins, noTotp };
  }, [rows]);

  // 운영자 비활성화 — EXECUTE 2단계 확인 + 사유 5자 → 실 server action 호출.
  function disableOperator(op: OperatorRow) {
    if (op.id === currentOperatorId) {
      setToast("본인 계정은 비활성화할 수 없습니다.");
      return;
    }
    if (op.disabled_at) {
      setToast("이미 비활성화된 운영자입니다.");
      return;
    }
    if (typeof window === "undefined") return;
    const phrase = window.prompt(
      `운영자 비활성화 — ${op.email}\n\n강력 액션입니다. 실행하려면 정확히 "${TWO_STEP_PHRASE}" 를 입력하세요.`,
    );
    if (phrase !== TWO_STEP_PHRASE) {
      setToast("운영자 비활성화 취소 — 확인 문구 불일치.");
      return;
    }
    const reason = window.prompt(
      "비활성화 사유를 입력하세요 (감사 로그에 기록됩니다, 5자 이상).",
    );
    if (!reason || reason.trim().length < 5) {
      setToast("사유가 5자 이상 필요합니다. 액션을 취소했습니다.");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.set("operator_id", op.id);
      fd.set("reason", reason.trim());
      const res = await disableOperatorAction(fd);
      // 운영자 액션을 세션 audit trail 에도 기록 — Server audit_log (operator_role_changed)
      // 는 server action 이 자동 기록. 여기 trail 은 운영자가 방금 한 조치를 화면에 표시.
      await recordOpsAuditWithSilentRetry({
        action: "operator.disable",
        target_label: `${op.email} · ${roleLabel(op.role)}`,
        target_id: op.id,
        reason: reason.trim(),
        operator: currentOperatorEmail ?? "(현재 운영자 세션)",
        outcome: res.ok ? "succeeded" : "failed",
      });
      setAuditTick((t) => t + 1);
      if (!res.ok) {
        setToast(`운영자 비활성화 실패 — ${res.message}`);
        return;
      }
      setDisabledOverrides((prev) => ({
        ...prev,
        [op.id]: new Date().toISOString(),
      }));
      setToast(`${op.email} 운영자를 비활성화했습니다.`);
    });
  }

  const columns: Column<OperatorRow>[] = [
    {
      key: "email",
      header: "이메일",
      render: (o) => (
        <span className="font-medium text-slate-800" title={o.email}>
          {maskEmail(o.email)}
          {o.id === currentOperatorId ? (
            <span className="chip chip-muted ml-2">본인</span>
          ) : null}
        </span>
      ),
    },
    {
      key: "role",
      header: "역할",
      render: (o) => (
        <span className={roleChip[o.role] ?? "chip chip-muted"}>{roleLabel(o.role)}</span>
      ),
    },
    {
      key: "totp",
      header: "2FA",
      render: (o) =>
        o.totp_enrolled ? (
          <span className="chip chip-success">등록됨</span>
        ) : (
          <span className="chip chip-warn">미등록</span>
        ),
    },
    {
      key: "status",
      header: "상태",
      render: (o) =>
        o.disabled_at ? (
          <span className="chip chip-error">비활성</span>
        ) : (
          <span className="chip chip-success">활성</span>
        ),
    },
    {
      key: "last_login",
      header: "마지막 로그인",
      render: (o) => (
        <span className="text-xs text-muted">
          {o.last_login_at ? formatDate(o.last_login_at) : "기록 없음"}
        </span>
      ),
    },
    {
      key: "created",
      header: "등록일",
      render: (o) => <span className="text-xs text-muted">{formatDate(o.created_at)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (o) => (
        <button
          className="btn-danger text-xs disabled:opacity-50"
          type="button"
          disabled={isPending || Boolean(o.disabled_at) || o.id === currentOperatorId}
          onClick={() => disableOperator(o)}
        >
          {o.disabled_at ? "비활성됨" : "비활성화"}
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="활성 운영자"
          value={String(summary.active)}
          hint="로그인 가능"
          accent="blue"
        />
        <StatCard
          label="최고관리자"
          value={String(summary.superadmins)}
          delta={summary.superadmins <= 1 ? "단일 superadmin" : undefined}
          deltaTone={summary.superadmins <= 1 ? "down" : "flat"}
          hint="superadmin 역할"
          accent="pink"
        />
        <StatCard
          label="2FA 미등록"
          value={String(summary.noTotp)}
          delta={summary.noTotp > 0 ? "등록 권장" : "전원 등록"}
          deltaTone={summary.noTotp > 0 ? "down" : "up"}
          hint="활성 운영자 기준"
          accent="orange"
        />
        <StatCard
          label="비활성 운영자"
          value={String(summary.disabled)}
          hint="로그인 차단됨"
          accent="teal"
        />
      </section>

      <PanelCard
        title="운영자 목록"
        description="ICONIA 운영 콘솔에 접근할 수 있는 운영자 계정. 비활성화는 최고관리자만 수행할 수 있습니다."
        actions={
          <button
            className="btn-primary text-sm"
            type="button"
            onClick={() => setInviting(true)}
          >
            + 운영자 초대
          </button>
        }
      >
        {loadError ? (
          <div className="py-10 text-center">
            <p className="text-sm text-rose-600">{loadError}</p>
            <p className="text-xs text-muted mt-1">
              superadmin 권한이 필요하거나 서버에 연결할 수 없습니다. 새로고침하거나
              ICONIA-SERVER 상태를 확인하세요.
            </p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            empty="등록된 운영자가 없습니다. 운영자 초대로 계정을 추가하세요."
          />
        )}
      </PanelCard>

      <OpsAuditTrailPanel
        prefix="operator."
        title="운영자 관리 활동 기록 (세션)"
        description="운영자 초대·비활성화 등 권한 변경 내역이 감사 로그에 기록됩니다."
        refresh={{ tick: auditTick }}
      />

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

      {inviting ? (
        <InviteModal
          currentOperatorEmail={currentOperatorEmail}
          onClose={() => setInviting(false)}
          onInvited={(email) => {
            setInviting(false);
            setAuditTick((t) => t + 1);
            setToast(
              `${email} 초대 요청을 감사 로그에 기록했습니다. (Server 초대 엔드포인트 연동 후 메일 발송)`,
            );
          }}
        />
      ) : null}
    </div>
  );
}

// 운영자 초대 모달.
// Server 측 초대 엔드포인트 (POST /api/v1/operator/admin/operators) 는 아직 없음 —
// 본 모달은 입력 검증 + 세션 audit trail 기록만 수행한다 (dead button 방지).
// TODO(server-wire-up): Server 운영자 초대 라우트 도입 후 inviteOperator() API 연결.
function InviteModal({
  currentOperatorEmail,
  onClose,
  onInvited,
}: {
  currentOperatorEmail: string | null;
  onClose: () => void;
  onInvited: (email: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OperatorRole>("viewer");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validEmail(value: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  async function submit() {
    const trimmedEmail = email.trim();
    if (!validEmail(trimmedEmail)) {
      setError("유효한 이메일 주소를 입력하세요.");
      return;
    }
    if (reason.trim().length < 5) {
      setError("초대 사유는 5자 이상 입력하세요 (감사 로그 기록).");
      return;
    }
    setError(null);
    setSubmitting(true);
    // Server 초대 엔드포인트 부재 — 세션 audit trail 에만 기록 (canonical 은 도입 후).
    const result = await recordOpsAuditWithSilentRetry({
      action: "operator.invite",
      target_label: `${trimmedEmail} · ${roleLabel(role)}`,
      target_id: trimmedEmail,
      reason: reason.trim(),
      operator: currentOperatorEmail ?? "(현재 운영자 세션)",
      outcome: "queued",
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(`초대 기록 최종 실패 — 운영자 확인 필요. [${result.attempts}회 시도]`);
      return;
    }
    onInvited(trimmedEmail);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-3 bg-black/30">
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 relative">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">운영자 초대</h3>
        <p className="text-xs text-muted mt-0.5">
          신규 운영자에게 역할을 부여해 콘솔 접근을 허용합니다.
        </p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-600">
            이메일
            <input
              className="input mt-1"
              type="email"
              placeholder="operator@iconia.example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="off"
            />
          </label>
          <label className="block text-xs text-slate-600">
            역할
            <select
              className="select mt-1"
              value={role}
              onChange={(e) => setRole(e.target.value as OperatorRole)}
            >
              {ALL_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[11px] text-muted">
            {roleLabel(role)} — {roleHint(role)}
          </p>
          <label className="block text-xs text-slate-600">
            초대 사유
            <textarea
              className="input mt-1 min-h-[72px]"
              placeholder="예: 신규 CS 담당자 온보딩 (5자 이상)"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={300}
            />
          </label>
          {error ? (
            <p className="text-xs text-rose-600 bg-rose-50/80 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          ) : null}
          <p className="text-[11px] text-muted bg-white/55 border border-white/55 rounded-xl px-3 py-2">
            ※ Server 운영자 초대 엔드포인트 도입 전까지 본 초대는 감사 로그에만 기록되며
            실제 메일 발송은 후속 연동에서 활성화됩니다.
          </p>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose}>
            취소
          </button>
          <button
            className="btn-primary text-sm disabled:opacity-50"
            type="button"
            onClick={submit}
            disabled={submitting}
          >
            {submitting ? "기록 중..." : "초대 기록"}
          </button>
        </div>
      </div>
    </div>
  );
}

function roleHint(role: OperatorRole): string {
  switch (role) {
    case "superadmin":
      return "모든 권한. 운영자 생성·비활성화·역할 변경.";
    case "sre":
      return "운영 조작 — 디바이스·OTA·페르소나·운영 안정성.";
    case "secops":
      return "보안 관찰 — 감사 로그·디바이스·의심 활동.";
    case "cs":
      return "고객지원 — 사용자 검색·신고 처리·강제 로그아웃.";
    case "viewer":
      return "읽기 전용 — 대시보드·통계·에러 모니터링 조회.";
  }
}
