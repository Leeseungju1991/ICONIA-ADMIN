"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { mockFirmwareErrors, formatDate, type FirmwareErrorRow } from "@/lib/mockData";

const severityChip: Record<FirmwareErrorRow["severity"], string> = {
  critical: "chip chip-error",
  error: "chip chip-warn",
  warn: "chip chip-muted",
};

export default function FirmwareErrorsPage() {
  const [severity, setSeverity] = useState<"all" | FirmwareErrorRow["severity"]>("all");
  const [version, setVersion] = useState<"all" | string>("all");

  const versions = useMemo(
    () => Array.from(new Set(mockFirmwareErrors.map((e) => e.firmware_version))).sort(),
    [],
  );

  const filtered = useMemo(
    () =>
      mockFirmwareErrors.filter((e) => {
        if (severity !== "all" && e.severity !== severity) return false;
        if (version !== "all" && e.firmware_version !== version) return false;
        return true;
      }),
    [severity, version],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { total: mockFirmwareErrors.reduce((s, e) => s + e.count, 0) };
    for (const e of mockFirmwareErrors) c[e.severity] = (c[e.severity] ?? 0) + e.count;
    return c;
  }, []);

  const columns: Column<FirmwareErrorRow>[] = [
    { key: "sev", header: "심각도", render: (r) => <span className={severityChip[r.severity]}>{r.severity}</span> },
    { key: "code", header: "에러 코드", render: (r) => <span className="font-mono text-xs font-medium text-slate-800">{r.error_code}</span> },
    { key: "msg", header: "메시지", render: (r) => <span className="text-slate-700 line-clamp-1 max-w-[300px] inline-block align-middle">{r.message}</span> },
    { key: "device", header: "디바이스", render: (r) => <span className="font-mono text-xs">{r.device_id}</span> },
    { key: "ver", header: "FW", render: (r) => <span className="chip chip-info">{r.firmware_version}</span> },
    { key: "count", header: "발생 횟수", align: "right", render: (r) => r.count.toLocaleString() },
    { key: "first", header: "최초", render: (r) => <span className="text-xs text-muted">{formatDate(r.first_seen)}</span> },
    { key: "last", header: "최근", render: (r) => <span className="text-xs text-muted">{formatDate(r.last_seen)}</span> },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="총 발생 건수" value={counts.total.toLocaleString()} hint="누적" accent="orange" />
        <StatCard label="Critical" value={String(counts.critical ?? 0)} hint="긴급 조치 필요" accent="pink" />
        <StatCard label="Error" value={String(counts.error ?? 0)} hint="조사 필요" accent="orange" />
        <StatCard label="Warn" value={String(counts.warn ?? 0)} hint="추적 중" accent="teal" />
      </section>

      <PanelCard
        title="펌웨어 에러 로그"
        description="ESP32 디바이스에서 보고된 펌웨어 런타임 에러와 OTA 실패 로그"
        actions={
          <>
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
            <button className="btn-outline text-sm" type="button">CSV 내보내기</button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="조건에 맞는 펌웨어 에러가 없습니다." />
      </PanelCard>
    </div>
  );
}
