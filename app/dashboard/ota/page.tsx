"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { OpsAuditTrailPanel } from "../_components/OpsAuditTrailPanel";
import { mockOtaFirmwares, formatDate, type OtaFirmwareRow } from "@/lib/mockData";
import { mockOpsActions, OPS_KIND_LABEL, type OpsActionRow } from "@/lib/mockOpsActions";
import { lookupErrorCode, operatorLabelForCode } from "@/lib/errorCatalog";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";

// OTA 관리 — 펌웨어 업로드, 채널(stable/beta/canary) 배포, 진행률, 롤백.
// 데모 mock. 백엔드 연동 시 lib/adminApi.ts 로 교체.

const channelChip: Record<OtaFirmwareRow["channel"], string> = {
  stable: "chip chip-success",
  beta: "chip chip-info",
  canary: "chip chip-warn",
};

const stateInfo: Record<OtaFirmwareRow["state"], { label: string; chip: string }> = {
  draft: { label: "초안", chip: "chip chip-muted" },
  rolling_out: { label: "배포 중", chip: "chip chip-warn" },
  completed: { label: "완료", chip: "chip chip-success" },
  rolled_back: { label: "롤백됨", chip: "chip chip-error" },
};

function formatSize(b: number): string {
  if (b > 1_000_000) return `${(b / 1_000_000).toFixed(2)} MB`;
  if (b > 1000) return `${(b / 1000).toFixed(1)} KB`;
  return `${b} B`;
}

function progressPct(r: OtaFirmwareRow): number {
  if (r.target_count === 0) return 0;
  return Math.min(100, Math.round((r.applied_count / r.target_count) * 100));
}

export default function OtaPage() {
  const [channel, setChannel] = useState<"all" | OtaFirmwareRow["channel"]>("all");
  const [state, setState] = useState<"all" | OtaFirmwareRow["state"]>("all");
  const [composing, setComposing] = useState(false);
  const [picked, setPicked] = useState<OtaFirmwareRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [auditTick, setAuditTick] = useState(0);

  const filtered = useMemo(
    () =>
      mockOtaFirmwares.filter((f) => {
        if (channel !== "all" && f.channel !== channel) return false;
        if (state !== "all" && f.state !== state) return false;
        return true;
      }),
    [channel, state],
  );

  const stats = useMemo(() => {
    const total = mockOtaFirmwares.length;
    const rolling = mockOtaFirmwares.filter((f) => f.state === "rolling_out").length;
    const targets = mockOtaFirmwares.reduce((s, f) => s + f.target_count, 0);
    const applied = mockOtaFirmwares.reduce((s, f) => s + f.applied_count, 0);
    const failed = mockOtaFirmwares.reduce((s, f) => s + f.failed_count, 0);
    return { total, rolling, targets, applied, failed };
  }, []);

  const columns: Column<OtaFirmwareRow>[] = [
    { key: "ver", header: "버전", render: (r) => <span className="font-mono text-sm font-medium text-slate-800">{r.version}</span> },
    { key: "ch", header: "채널", render: (r) => <span className={channelChip[r.channel]}>{r.channel}</span> },
    { key: "size", header: "크기", align: "right", render: (r) => <span className="text-xs text-slate-700">{formatSize(r.size_bytes)}</span> },
    { key: "state", header: "상태", render: (r) => <span className={stateInfo[r.state].chip}>{stateInfo[r.state].label}</span> },
    {
      key: "progress",
      header: "진행률",
      render: (r) => (
        <div className="flex items-center gap-2 min-w-[140px]">
          <div className="flex-1 h-2 rounded-full bg-white/60 overflow-hidden">
            <div
              className={r.state === "rolled_back" ? "h-full bg-rose-500" : "h-full bg-accent"}
              style={{ width: `${progressPct(r)}%` }}
            />
          </div>
          <span className="text-[11px] text-muted w-10 text-right">{progressPct(r)}%</span>
        </div>
      ),
    },
    {
      key: "counts",
      header: "적용/대상",
      align: "right",
      render: (r) => (
        <span className="text-xs text-slate-700">
          {r.applied_count.toLocaleString()} / {r.target_count.toLocaleString()}
        </span>
      ),
    },
    { key: "fail", header: "실패", align: "right", render: (r) => <span className={r.failed_count > 0 ? "text-rose-600" : "text-slate-500"}>{r.failed_count}</span> },
    { key: "up", header: "업로드", render: (r) => <span className="text-xs text-muted">{formatDate(r.uploaded_at)}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button className="btn-outline text-xs" type="button" onClick={() => setPicked(r)}>
          상세
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="등록 펌웨어" value={String(stats.total)} hint="누적" accent="blue" />
        <StatCard label="배포 중" value={String(stats.rolling)} hint="진행 중인 캠페인" accent="orange" />
        <StatCard
          label="총 적용"
          value={stats.applied.toLocaleString()}
          delta={stats.targets > 0 ? `${((stats.applied / stats.targets) * 100).toFixed(0)}%` : "—"}
          deltaTone="up"
          hint={`/ ${stats.targets.toLocaleString()} 대상`}
          accent="teal"
        />
        <StatCard label="실패" value={stats.failed.toLocaleString()} hint="누적 OTA 실패" accent="pink" />
      </section>

      <PanelCard
        title="펌웨어 빌드"
        description="채널별 펌웨어 배포 상태와 진행률. 새 빌드는 업로드 → 채널 선정 → 배포 시작 순으로 처리됩니다."
        actions={
          <>
            <select
              className="select max-w-[120px]"
              value={channel}
              onChange={(e) => setChannel(e.target.value as typeof channel)}
            >
              <option value="all">전체 채널</option>
              <option value="stable">stable</option>
              <option value="beta">beta</option>
              <option value="canary">canary</option>
            </select>
            <select
              className="select max-w-[140px]"
              value={state}
              onChange={(e) => setState(e.target.value as typeof state)}
            >
              <option value="all">전체 상태</option>
              <option value="draft">초안</option>
              <option value="rolling_out">배포 중</option>
              <option value="completed">완료</option>
              <option value="rolled_back">롤백됨</option>
            </select>
            <button className="btn-primary text-sm" type="button" onClick={() => setComposing(true)}>
              + 새 펌웨어 업로드
            </button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="등록된 펌웨어가 없습니다." />
      </PanelCard>

      <FailedOpsPanel
        kindFilter={["ota_rollout", "ota_rollback"]}
        emptyText="실패한 OTA 배포 액션이 없습니다."
        onRetried={() => setAuditTick((t) => t + 1)}
        onToast={setToast}
      />

      <OpsAuditTrailPanel
        prefix="ota."
        title="OTA 운영자 액션 audit (세션)"
        description="배포 시작·일시중지·롤백·재시도 기록. 백엔드 연동 후 Server audit_log 와 머지."
        refresh={{ tick: auditTick }}
      />

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card">
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">닫기</button>
        </div>
      ) : null}

      {composing ? <UploadModal onClose={() => setComposing(false)} onToast={setToast} /> : null}
      {picked ? (
        <FirmwareDrawer
          firmware={picked}
          onClose={() => setPicked(null)}
          onToast={setToast}
          onActionRecorded={() => setAuditTick((t) => t + 1)}
        />
      ) : null}
    </div>
  );
}

// ── 실패한 OTA / 운영자 액션 패널 + retry / rollback 버튼 ─────────
function FailedOpsPanel({
  kindFilter,
  emptyText,
  onRetried,
  onToast,
}: {
  kindFilter: OpsActionRow["kind"][];
  emptyText: string;
  onRetried: () => void;
  onToast: (msg: string) => void;
}) {
  const rows = mockOpsActions.filter(
    (a) => kindFilter.includes(a.kind) && (a.status === "failed" || a.status === "queued"),
  );

  async function runRetry(row: OpsActionRow) {
    const code = row.failure_code ?? "";
    const entry = lookupErrorCode(code);
    if (code && !entry.retryable) {
      onToast(`${code} (${entry.label}) 는 자동 재시도 불가. 수동 점검 필요.`);
      return;
    }
    const reason = window.prompt("재시도 사유 (5자 이상, 감사 로그에 기록).");
    if (!reason || reason.trim().length < 5) {
      onToast("사유가 5자 이상 필요합니다.");
      return;
    }
    // 일시 실패는 silent retry — 운영자 본인 액션이므로 transient 실패를 노출하지 않음.
    const result = await recordOpsAuditWithSilentRetry({
      action: `ota.${row.kind === "ota_rollback" ? "rollback_retry" : "rollout_retry"}`,
      target_label: row.target_label,
      target_id: row.target_id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "queued",
    });
    onRetried();
    if (result.ok) {
      onToast(`재시도 요청을 audit trail 에 기록했습니다. (대상: ${row.target_label})`);
    } else {
      onToast(
        `재시도 큐 적재 최종 실패 — 운영자 확인 필요. (대상: ${row.target_label}) [${result.attempts}회 시도]`,
      );
    }
  }

  async function runRollback(row: OpsActionRow) {
    const reason = window.prompt("롤백 사유 (5자 이상, 감사 로그에 기록).");
    if (!reason || reason.trim().length < 5) {
      onToast("사유가 5자 이상 필요합니다.");
      return;
    }
    const result = await recordOpsAuditWithSilentRetry({
      action: "ota.rollback_manual",
      target_label: row.target_label,
      target_id: row.target_id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "queued",
    });
    onRetried();
    if (result.ok) {
      onToast(`롤백 요청을 audit trail 에 기록했습니다. (대상: ${row.target_label})`);
    } else {
      onToast(
        `롤백 큐 적재 최종 실패 — 운영자 확인 필요. (대상: ${row.target_label}) [${result.attempts}회 시도]`,
      );
    }
  }

  return (
    <PanelCard
      title="실패한 운영자 액션"
      description="배포 캠페인 중 실패 / 대기 상태인 액션. retry/rollback 은 사유 입력 → 세션 audit trail 기록."
    >
      {rows.length === 0 ? (
        <div className="py-8 text-center text-xs text-muted">{emptyText}</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => (
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
                  <span className="font-mono text-xs text-slate-700 truncate max-w-[200px]">
                    {r.target_label}
                  </span>
                </div>
                <div className="text-[11px] text-muted mt-1">
                  {r.failure_reason ? `${r.failure_reason} · 재시도 ${r.retry_count}회` : "대기 중"}
                  {r.failure_code ? (
                    <span className="ml-2 font-mono text-slate-700">
                      ({operatorLabelForCode(r.failure_code)})
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button className="btn-outline text-xs" type="button" onClick={() => runRetry(r)}>
                  재시도
                </button>
                <button className="btn-danger text-xs" type="button" onClick={() => runRollback(r)}>
                  롤백
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

function UploadModal({ onClose, onToast }: { onClose: () => void; onToast: (msg: string) => void }) {
  const [version, setVersion] = useState("");
  const [channel, setChannel] = useState<OtaFirmwareRow["channel"]>("canary");
  const [notes, setNotes] = useState("");

  function submit() {
    if (!version.trim()) {
      onToast("버전을 입력하세요.");
      return;
    }
    onToast(`펌웨어 ${version} (${channel}) 업로드 요청을 기록했습니다. (백엔드 연동 후 활성화)`);
    onClose();
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
        <h3 className="text-lg font-bold text-slate-900">새 펌웨어 업로드</h3>
        <p className="text-xs text-muted">.bin 파일 + 버전·채널·릴리스 노트.</p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-600">
            펌웨어 파일 (.bin)
            <input className="input mt-1" type="file" accept=".bin" />
          </label>
          <label className="block text-xs text-slate-600">
            버전
            <input
              className="input mt-1"
              placeholder="예: 1.5.0"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            />
          </label>
          <label className="block text-xs text-slate-600">
            채널
            <select
              className="select mt-1"
              value={channel}
              onChange={(e) => setChannel(e.target.value as OtaFirmwareRow["channel"])}
            >
              <option value="canary">canary (내부 테스트)</option>
              <option value="beta">beta (조기 채택자)</option>
              <option value="stable">stable (전체 배포)</option>
            </select>
          </label>
          <label className="block text-xs text-slate-600">
            릴리스 노트
            <textarea
              className="input mt-1 min-h-[100px]"
              placeholder="변경 사항·알려진 이슈"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose}>취소</button>
          <button className="btn-primary text-sm" type="button" onClick={submit}>업로드</button>
        </div>
      </div>
    </div>
  );
}

function FirmwareDrawer({
  firmware,
  onClose,
  onToast,
  onActionRecorded,
}: {
  firmware: OtaFirmwareRow;
  onClose: () => void;
  onToast: (msg: string) => void;
  onActionRecorded: () => void;
}) {
  async function runAction(label: string, actionCode: string) {
    const reason = window.prompt(`${label} 사유를 입력하세요 (감사 로그에 기록됩니다, 5자 이상).`);
    if (!reason || reason.trim().length < 5) {
      onToast("사유가 5자 이상 필요합니다.");
      return;
    }
    const result = await recordOpsAuditWithSilentRetry({
      action: `ota.${actionCode}`,
      target_label: `${firmware.version} (${firmware.channel})`,
      target_id: firmware.id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "queued",
    });
    onActionRecorded();
    if (result.ok) {
      onToast(`${label} 요청을 audit trail 에 기록했습니다. (백엔드 연동 후 실제 실행)`);
    } else {
      onToast(`${label} 최종 실패 — 운영자 확인 필요. [${result.attempts}회 시도]`);
    }
  }

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
        <h3 className="text-lg font-bold text-slate-900">펌웨어 상세</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{firmware.version}</p>

        <dl className="mt-5 space-y-3 text-sm">
          <Row k="채널" v={<span className={channelChip[firmware.channel]}>{firmware.channel}</span>} />
          <Row k="상태" v={<span className={stateInfo[firmware.state].chip}>{stateInfo[firmware.state].label}</span>} />
          <Row k="크기" v={formatSize(firmware.size_bytes)} />
          <Row k="업로드" v={formatDate(firmware.uploaded_at)} />
          <Row k="대상" v={`${firmware.target_count.toLocaleString()} 기기`} />
          <Row k="적용 완료" v={`${firmware.applied_count.toLocaleString()} (${progressPct(firmware)}%)`} />
          <Row
            k="실패"
            v={<span className={firmware.failed_count > 0 ? "text-rose-600 font-semibold" : ""}>{firmware.failed_count}</span>}
          />
        </dl>

        <div className="rounded-xl bg-white/60 border border-white/60 p-3 mt-3">
          <div className="text-xs text-muted mb-1">릴리스 노트</div>
          <p className="text-sm text-slate-800 whitespace-pre-wrap">{firmware.notes}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          {firmware.state === "draft" ? (
            <button className="btn-primary text-sm" type="button" onClick={() => runAction("배포 시작", "rollout_start")}>배포 시작</button>
          ) : null}
          {firmware.state === "rolling_out" ? (
            <>
              <button className="btn-outline text-sm" type="button" onClick={() => runAction("배포 일시중지", "rollout_pause")}>일시중지</button>
              <button className="btn-danger text-sm" type="button" onClick={() => runAction("배포 중단", "rollout_abort")}>중단</button>
            </>
          ) : null}
          {firmware.state === "completed" || firmware.state === "rolling_out" ? (
            <button className="btn-danger text-sm" type="button" onClick={() => runAction("롤백", "rollback")}>롤백</button>
          ) : null}
          <button className="btn-outline text-sm" type="button" onClick={() => runAction(".bin 다운로드", "binary_download")}>.bin 다운로드</button>
        </div>
        <p className="text-[11px] text-muted mt-3">※ 데모 환경 — 액션은 감사 로그만 기록됩니다.</p>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="text-sm text-slate-800 font-medium">{v}</dd>
    </div>
  );
}
