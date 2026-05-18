"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { mockServerErrors, formatDate, type ServerErrorRow } from "@/lib/mockData";

function statusChip(code: number): string {
  if (code >= 500) return "chip chip-error";
  if (code >= 400) return "chip chip-warn";
  return "chip chip-info";
}

export default function ServerErrorsPage() {
  const [service, setService] = useState<"all" | ServerErrorRow["service"]>("all");
  const [statusBand, setStatusBand] = useState<"all" | "4xx" | "5xx">("all");

  const filtered = useMemo(
    () =>
      mockServerErrors.filter((e) => {
        if (service !== "all" && e.service !== service) return false;
        if (statusBand === "4xx" && !(e.status_code >= 400 && e.status_code < 500)) return false;
        if (statusBand === "5xx" && !(e.status_code >= 500)) return false;
        return true;
      }),
    [service, statusBand],
  );

  const stats = useMemo(() => {
    const total = mockServerErrors.reduce((s, e) => s + e.count, 0);
    const fivexx = mockServerErrors.filter((e) => e.status_code >= 500).reduce((s, e) => s + e.count, 0);
    const fourxx = mockServerErrors.filter((e) => e.status_code >= 400 && e.status_code < 500).reduce((s, e) => s + e.count, 0);
    const services = new Set(mockServerErrors.map((e) => e.service)).size;
    return { total, fivexx, fourxx, services };
  }, []);

  const columns: Column<ServerErrorRow>[] = [
    { key: "code", header: "상태", render: (r) => <span className={statusChip(r.status_code)}>{r.status_code}</span> },
    { key: "service", header: "서비스", render: (r) => <span className="chip chip-muted">{r.service}</span> },
    { key: "path", header: "경로", render: (r) => <span className="font-mono text-xs text-slate-700">{r.path}</span> },
    { key: "msg", header: "메시지", render: (r) => <span className="text-slate-700 line-clamp-1 max-w-[320px] inline-block align-middle">{r.message}</span> },
    { key: "count", header: "발생", align: "right", render: (r) => r.count.toLocaleString() },
    { key: "first", header: "최초", render: (r) => <span className="text-xs text-muted">{formatDate(r.first_seen)}</span> },
    { key: "last", header: "최근", render: (r) => <span className="text-xs text-muted">{formatDate(r.last_seen)}</span> },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="총 에러 (24h)" value={stats.total.toLocaleString()} hint="모든 서비스" accent="orange" />
        <StatCard label="5xx" value={stats.fivexx.toLocaleString()} delta="서버 측" deltaTone="down" accent="pink" />
        <StatCard label="4xx" value={stats.fourxx.toLocaleString()} delta="요청 측" deltaTone="flat" accent="blue" />
        <StatCard label="영향 서비스" value={String(stats.services)} hint="서비스 종류" accent="teal" />
      </section>

      <PanelCard
        title="AWS 백엔드 에러 로그"
        description="EC2/AI worker/Persona/Webhook 등에서 발생한 5xx/4xx 응답과 예외"
        actions={
          <>
            <select
              className="select max-w-[180px]"
              value={service}
              onChange={(e) => setService(e.target.value as typeof service)}
            >
              <option value="all">전체 서비스</option>
              <option value="express-api">express-api</option>
              <option value="ai-worker">ai-worker</option>
              <option value="persona">persona</option>
              <option value="billing-webhook">billing-webhook</option>
            </select>
            <select
              className="select max-w-[120px]"
              value={statusBand}
              onChange={(e) => setStatusBand(e.target.value as typeof statusBand)}
            >
              <option value="all">전체</option>
              <option value="5xx">5xx</option>
              <option value="4xx">4xx</option>
            </select>
            <button className="btn-outline text-sm" type="button">로그 다운로드</button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="해당 조건의 서버 에러가 없습니다." />
      </PanelCard>

      <PanelCard title="서비스 상태" description="현재 운영 중인 백엔드 서비스 헬스">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { name: "express-api", state: "정상", chip: "chip chip-success", note: "p95 134ms" },
            { name: "ai-worker", state: "주의", chip: "chip chip-warn", note: "p95 4.2s" },
            { name: "persona", state: "주의", chip: "chip chip-warn", note: "429 이슈" },
            { name: "billing-webhook", state: "정상", chip: "chip chip-success", note: "큐 0건" },
          ].map((s) => (
            <div key={s.name} className="rounded-2xl bg-white/55 border border-white/60 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm text-slate-800">{s.name}</span>
                <span className={s.chip}>{s.state}</span>
              </div>
              <p className="text-[11px] text-muted mt-2">{s.note}</p>
            </div>
          ))}
        </div>
      </PanelCard>
    </div>
  );
}
