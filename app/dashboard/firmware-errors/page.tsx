"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { OpsAuditTrailPanel } from "../_components/OpsAuditTrailPanel";
import { mockFirmwareErrors, formatDate, type FirmwareErrorRow } from "@/lib/mockData";
import {
  CATEGORY_LABEL,
  lookupErrorCode,
  operatorLabelForCode,
  USER_VISIBILITY_CHIP,
  USER_VISIBILITY_LABEL,
} from "@/lib/errorCatalog";
import {
  exportCsv,
  exportJson,
  isoDateStamp,
  type ExportColumn,
} from "@/lib/exportData";
import { recordOpsAuditWithSilentRetry } from "@/lib/opsAuditTrail";

const severityChip: Record<FirmwareErrorRow["severity"], string> = {
  critical: "chip chip-error",
  error: "chip chip-warn",
  warn: "chip chip-muted",
};

const exportColumns: ExportColumn<FirmwareErrorRow>[] = [
  { key: "id", header: "id", value: (r) => r.id },
  { key: "device_id", header: "device_id", value: (r) => r.device_id },
  { key: "firmware_version", header: "firmware_version", value: (r) => r.firmware_version },
  { key: "error_code", header: "error_code", value: (r) => r.error_code },
  { key: "operator_label", header: "operator_label", value: (r) => operatorLabelForCode(r.error_code) },
  { key: "category", header: "category", value: (r) => lookupErrorCode(r.error_code).category },
  { key: "user_visibility", header: "user_visibility", value: (r) => lookupErrorCode(r.error_code).userVisibility },
  { key: "severity", header: "severity", value: (r) => r.severity },
  { key: "message", header: "message", value: (r) => r.message },
  { key: "count", header: "count", value: (r) => r.count },
  { key: "first_seen", header: "first_seen", value: (r) => r.first_seen },
  { key: "last_seen", header: "last_seen", value: (r) => r.last_seen },
];

export default function FirmwareErrorsPage() {
  const [severity, setSeverity] = useState<"all" | FirmwareErrorRow["severity"]>("all");
  const [version, setVersion] = useState<"all" | string>("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<FirmwareErrorRow | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const versions = useMemo(
    () => Array.from(new Set(mockFirmwareErrors.map((e) => e.firmware_version))).sort(),
    [],
  );

  const filtered = useMemo(
    () =>
      mockFirmwareErrors.filter((e) => {
        if (severity !== "all" && e.severity !== severity) return false;
        if (version !== "all" && e.firmware_version !== version) return false;
        if (q) {
          const s = q.toLowerCase();
          const label = operatorLabelForCode(e.error_code).toLowerCase();
          if (
            !e.error_code.toLowerCase().includes(s) &&
            !e.message.toLowerCase().includes(s) &&
            !e.device_id.toLowerCase().includes(s) &&
            !label.includes(s)
          ) {
            return false;
          }
        }
        return true;
      }),
    [severity, version, q],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: mockFirmwareErrors.reduce((s, e) => s + e.count, 0) };
    for (const e of mockFirmwareErrors) c[e.severity] = (c[e.severity] ?? 0) + e.count;
    return c;
  }, []);

  async function runRetry(row: FirmwareErrorRow, kind: "ota_retry" | "device_reboot") {
    const entry = lookupErrorCode(row.error_code);
    if (kind === "ota_retry" && !entry.retryable) {
      setToast(`${row.error_code} 는 자동 재시도 불가 코드입니다. 수동 조치가 필요합니다.`);
      return;
    }
    const reason = window.prompt(
      `${kind === "ota_retry" ? "OTA 재시도" : "디바이스 재부팅 요청"} 사유 (5자 이상, 감사 로그에 기록).`,
    );
    if (!reason || reason.trim().length < 5) {
      setToast("사유가 5자 이상 필요합니다.");
      return;
    }
    // 운영자 액션이므로 일시 실패는 silent retry.
    const result = await recordOpsAuditWithSilentRetry({
      action: `firmware.${kind}`,
      target_label: `${row.device_id} (${row.firmware_version})`,
      target_id: row.device_id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "queued",
    });
    setAuditTick((t) => t + 1);
    if (result.ok) {
      setToast(
        `${kind === "ota_retry" ? "OTA 재시도" : "재부팅"} 요청을 큐에 기록했습니다. (백엔드 연동 후 실제 실행)`,
      );
    } else {
      setToast(
        `${kind === "ota_retry" ? "OTA 재시도" : "재부팅"} 큐 적재 최종 실패 — 운영자 확인 필요. [${result.attempts}회 시도]`,
      );
    }
  }

  const columns: Column<FirmwareErrorRow>[] = [
    { key: "sev", header: "심각도", render: (r) => <span className={severityChip[r.severity]}>{r.severity}</span> },
    {
      key: "code",
      header: "에러 코드 / 운영자 라벨",
      render: (r) => {
        const entry = lookupErrorCode(r.error_code);
        return (
          <div className="min-w-0">
            <div className="font-mono text-xs font-medium text-slate-800">{r.error_code}</div>
            <div className="text-[11px] text-slate-600 truncate max-w-[260px]">
              {entry.label}
              <span className="ml-1 text-muted">· {CATEGORY_LABEL[entry.category]}</span>
            </div>
          </div>
        );
      },
    },
    { key: "msg", header: "메시지", render: (r) => <span className="text-slate-700 line-clamp-1 max-w-[280px] inline-block align-middle">{r.message}</span> },
    {
      key: "uv",
      header: "사용자 인지",
      render: (r) => {
        const v = lookupErrorCode(r.error_code).userVisibility;
        return (
          <span className={USER_VISIBILITY_CHIP[v]} title={USER_VISIBILITY_LABEL[v]}>
            {USER_VISIBILITY_LABEL[v]}
          </span>
        );
      },
    },
    { key: "device", header: "디바이스", render: (r) => <span className="font-mono text-xs">{r.device_id}</span> },
    { key: "ver", header: "FW", render: (r) => <span className="chip chip-info">{r.firmware_version}</span> },
    { key: "count", header: "발생 횟수", align: "right", render: (r) => r.count.toLocaleString() },
    { key: "last", header: "최근", render: (r) => <span className="text-xs text-muted">{formatDate(r.last_seen)}</span> },
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
        <StatCard label="총 발생 건수" value={counts.total.toLocaleString()} hint="누적 (24h mock)" accent="orange" />
        <StatCard label="Critical" value={String(counts.critical ?? 0)} hint="긴급 조치 필요" accent="pink" />
        <StatCard label="Error" value={String(counts.error ?? 0)} hint="조사 필요" accent="orange" />
        <StatCard label="Warn" value={String(counts.warn ?? 0)} hint="추적 중" accent="teal" />
      </section>

      <PanelCard
        title="펌웨어 에러 로그"
        description="ESP32 디바이스에서 보고된 펌웨어 런타임 에러와 OTA 실패. 코드는 lib/errorCatalog 의 운영자 라벨로 환산."
        actions={
          <>
            <input
              className="input max-w-[220px]"
              placeholder="코드·메시지·디바이스 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="select max-w-[140px]"
              value={severity}
              onChange={(e) => setSeverity(e.target.value as typeof severity)}
            >
              <option value="all">전체 심각도</option>
              <option value="critical">Critical</option>
              <option value="error">Error</option>
              <option value="warn">Warn</option>
            </select>
            <select
              className="select max-w-[140px]"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            >
              <option value="all">전체 FW</option>
              {versions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <button
              className="btn-outline text-sm"
              type="button"
              onClick={() => exportCsv(exportColumns, filtered, `firmware-errors-${isoDateStamp()}.csv`)}
            >
              CSV
            </button>
            <button
              className="btn-outline text-sm"
              type="button"
              onClick={() => exportJson(exportColumns, filtered, `firmware-errors-${isoDateStamp()}.json`)}
            >
              JSON
            </button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="조건에 맞는 펌웨어 에러가 없습니다." />
      </PanelCard>

      <OpsAuditTrailPanel
        prefix="firmware."
        title="펌웨어 운영자 액션 audit (세션)"
        description="OTA 재시도·디바이스 재부팅 요청 기록. 백엔드 연동 후 Server audit_log 와 머지."
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

      {picked ? (
        <ErrorDrawer
          err={picked}
          onClose={() => setPicked(null)}
          onAction={(kind) => runRetry(picked, kind)}
        />
      ) : null}
    </div>
  );
}

function ErrorDrawer({
  err,
  onClose,
  onAction,
}: {
  err: FirmwareErrorRow;
  onClose: () => void;
  onAction: (kind: "ota_retry" | "device_reboot") => void;
}) {
  const entry = lookupErrorCode(err.error_code);
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
        <h3 className="text-lg font-bold text-slate-900">{entry.label}</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{err.error_code}</p>

        <div className="rounded-xl bg-slate-900/85 text-white p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words mt-4">
          {err.message}
        </div>

        <dl className="mt-4 space-y-3 text-sm">
          <Row k="카테고리" v={CATEGORY_LABEL[entry.category]} />
          <Row k="심각도" v={<span className={severityChip[err.severity]}>{err.severity}</span>} />
          <Row k="자동 재시도 가능" v={entry.retryable ? "예" : "아니오"} />
          <Row
            k="사용자 인지"
            v={
              <span className={USER_VISIBILITY_CHIP[entry.userVisibility]}>
                {USER_VISIBILITY_LABEL[entry.userVisibility]}
              </span>
            }
          />
          <Row k="디바이스" v={<span className="font-mono text-xs">{err.device_id}</span>} />
          <Row k="FW 버전" v={err.firmware_version} />
          <Row k="발생 횟수" v={err.count.toLocaleString()} />
          <Row k="최초" v={formatDate(err.first_seen)} />
          <Row k="최근" v={formatDate(err.last_seen)} />
        </dl>

        <div className="rounded-xl bg-white/60 border border-white/60 p-3 mt-3">
          <div className="text-xs text-muted mb-1">권장 조치</div>
          <p className="text-sm text-slate-800">{entry.recommendedAction}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button
            className="btn-primary text-sm disabled:opacity-50"
            type="button"
            disabled={!entry.retryable}
            onClick={() => onAction("ota_retry")}
          >
            OTA 재시도
          </button>
          <button className="btn-outline text-sm" type="button" onClick={() => onAction("device_reboot")}>
            재부팅 요청
          </button>
        </div>
        <p className="text-[11px] text-muted mt-3">
          ※ 액션은 세션 audit trail 에 기록됩니다. 실제 OTA/재부팅은 백엔드 연동 후 활성화.
        </p>
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
