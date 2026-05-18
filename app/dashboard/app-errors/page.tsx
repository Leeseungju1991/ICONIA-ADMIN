"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { mockAppErrors, formatDate, type AppErrorRow } from "@/lib/mockData";

const platformChip: Record<AppErrorRow["platform"], string> = {
  ios: "chip chip-info",
  android: "chip chip-success",
};

export default function AppErrorsPage() {
  const [platform, setPlatform] = useState<"all" | AppErrorRow["platform"]>("all");
  const [version, setVersion] = useState<"all" | string>("all");
  const [picked, setPicked] = useState<AppErrorRow | null>(null);

  const versions = useMemo(
    () => Array.from(new Set(mockAppErrors.map((e) => e.app_version))).sort(),
    [],
  );

  const filtered = useMemo(
    () =>
      mockAppErrors.filter((e) => {
        if (platform !== "all" && e.platform !== platform) return false;
        if (version !== "all" && e.app_version !== version) return false;
        return true;
      }),
    [platform, version],
  );

  const stats = useMemo(() => {
    const total = mockAppErrors.reduce((s, e) => s + e.count, 0);
    const users = mockAppErrors.reduce((s, e) => s + e.affected_users, 0);
    const ios = mockAppErrors.filter((e) => e.platform === "ios").reduce((s, e) => s + e.count, 0);
    const android = mockAppErrors.filter((e) => e.platform === "android").reduce((s, e) => s + e.count, 0);
    return { total, users, ios, android };
  }, []);

  const columns: Column<AppErrorRow>[] = [
    { key: "platform", header: "OS", render: (r) => <span className={platformChip[r.platform]}>{r.platform === "ios" ? "iOS" : "Android"}</span> },
    { key: "type", header: "유형", render: (r) => <span className="font-mono text-xs font-medium text-slate-800">{r.error_type}</span> },
    { key: "msg", header: "메시지", render: (r) => <span className="text-slate-700 line-clamp-1 max-w-[320px] inline-block align-middle">{r.message}</span> },
    { key: "ver", header: "앱 버전", render: (r) => <span className="chip chip-muted">v{r.app_version}</span> },
    { key: "os", header: "OS 버전", render: (r) => <span className="text-xs text-slate-700">{r.os_version}</span> },
    { key: "device", header: "기기", render: (r) => <span className="text-xs text-slate-700">{r.device_model}</span> },
    { key: "users", header: "영향 사용자", align: "right", render: (r) => r.affected_users },
    { key: "count", header: "발생", align: "right", render: (r) => r.count.toLocaleString() },
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
        <StatCard label="총 발생" value={stats.total.toLocaleString()} hint="24시간" accent="orange" />
        <StatCard label="영향 사용자" value={stats.users.toLocaleString()} hint="고유" accent="pink" />
        <StatCard label="iOS 에러" value={stats.ios.toLocaleString()} accent="blue" />
        <StatCard label="Android 에러" value={stats.android.toLocaleString()} accent="teal" />
      </section>

      <PanelCard
        title="앱 크래시 / 런타임 에러"
        description="RN Expo 앱(iOS·Android)에서 보고된 크래시와 unhandled exception"
        actions={
          <>
            <select
              className="select max-w-[140px]"
              value={platform}
              onChange={(e) => setPlatform(e.target.value as typeof platform)}
            >
              <option value="all">전체 OS</option>
              <option value="ios">iOS</option>
              <option value="android">Android</option>
            </select>
            <select
              className="select max-w-[140px]"
              value={version}
              onChange={(e) => setVersion(e.target.value)}
            >
              <option value="all">전체 버전</option>
              {versions.map((v) => (
                <option key={v} value={v}>v{v}</option>
              ))}
            </select>
            <button className="btn-outline text-sm" type="button">크래시 리포트 동기화</button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="조건에 맞는 앱 에러가 없습니다." />
      </PanelCard>

      {picked ? <ErrorDrawer err={picked} onClose={() => setPicked(null)} /> : null}
    </div>
  );
}

function ErrorDrawer({ err, onClose }: { err: AppErrorRow; onClose: () => void }) {
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
        <h3 className="text-lg font-bold text-slate-900">앱 에러 상세</h3>
        <p className="text-xs text-muted mt-0.5">{err.id}</p>

        <div className="mt-5 space-y-3 text-sm">
          <div className="rounded-xl bg-slate-900/85 text-white p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
            {err.message}
          </div>
          <RowBlock label="플랫폼" value={err.platform === "ios" ? "iOS" : "Android"} />
          <RowBlock label="앱 버전" value={`v${err.app_version}`} />
          <RowBlock label="OS 버전" value={err.os_version} />
          <RowBlock label="기기" value={err.device_model} />
          <RowBlock label="에러 유형" value={err.error_type} />
          <RowBlock label="영향 사용자" value={`${err.affected_users}명`} />
          <RowBlock label="발생 횟수" value={err.count.toLocaleString()} />
          <RowBlock label="최초" value={formatDate(err.first_seen)} />
          <RowBlock label="최근" value={formatDate(err.last_seen)} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-outline text-sm" type="button">이슈 생성</button>
          <button className="btn-outline text-sm" type="button">해결됨 처리</button>
        </div>
      </div>
    </div>
  );
}

function RowBlock({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <span className="text-xs text-muted">{label}</span>
      <span className="text-sm text-slate-800 font-medium">{value}</span>
    </div>
  );
}
