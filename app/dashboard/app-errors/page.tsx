"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { OpsAuditTrailPanel } from "../_components/OpsAuditTrailPanel";
import { mockAppErrors, formatDate, type AppErrorRow } from "@/lib/mockData";
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

const platformChip: Record<AppErrorRow["platform"], string> = {
  ios: "chip chip-info",
  android: "chip chip-success",
};

const exportColumns: ExportColumn<AppErrorRow>[] = [
  { key: "id", header: "id", value: (r) => r.id },
  { key: "platform", header: "platform", value: (r) => r.platform },
  { key: "app_version", header: "app_version", value: (r) => r.app_version },
  { key: "os_version", header: "os_version", value: (r) => r.os_version },
  { key: "error_type", header: "error_type", value: (r) => r.error_type },
  { key: "operator_label", header: "operator_label", value: (r) => operatorLabelForCode(r.error_type) },
  { key: "category", header: "category", value: (r) => lookupErrorCode(r.error_type).category },
  { key: "user_visibility", header: "user_visibility", value: (r) => lookupErrorCode(r.error_type).userVisibility },
  { key: "message", header: "message", value: (r) => r.message },
  { key: "device_model", header: "device_model", value: (r) => r.device_model },
  { key: "count", header: "count", value: (r) => r.count },
  { key: "affected_users", header: "affected_users", value: (r) => r.affected_users },
  { key: "first_seen", header: "first_seen", value: (r) => r.first_seen },
  { key: "last_seen", header: "last_seen", value: (r) => r.last_seen },
];

export default function AppErrorsPage() {
  const [platform, setPlatform] = useState<"all" | AppErrorRow["platform"]>("all");
  const [version, setVersion] = useState<"all" | string>("all");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<AppErrorRow | null>(null);
  const [auditTick, setAuditTick] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  const versions = useMemo(
    () => Array.from(new Set(mockAppErrors.map((e) => e.app_version))).sort(),
    [],
  );

  const filtered = useMemo(
    () =>
      mockAppErrors.filter((e) => {
        if (platform !== "all" && e.platform !== platform) return false;
        if (version !== "all" && e.app_version !== version) return false;
        if (q) {
          const s = q.toLowerCase();
          const label = operatorLabelForCode(e.error_type).toLowerCase();
          if (
            !e.error_type.toLowerCase().includes(s) &&
            !e.message.toLowerCase().includes(s) &&
            !e.device_model.toLowerCase().includes(s) &&
            !label.includes(s)
          ) {
            return false;
          }
        }
        return true;
      }),
    [platform, version, q],
  );

  const stats = useMemo(() => {
    const total = mockAppErrors.reduce((s, e) => s + e.count, 0);
    const users = mockAppErrors.reduce((s, e) => s + e.affected_users, 0);
    const ios = mockAppErrors.filter((e) => e.platform === "ios").reduce((s, e) => s + e.count, 0);
    const android = mockAppErrors.filter((e) => e.platform === "android").reduce((s, e) => s + e.count, 0);
    return { total, users, ios, android };
  }, []);

  // 출시준비 라운드 §6 — JS vs Native crash 분류. error_type prefix 로 분리.
  // Sentry 연동 시 이 집계는 Sentry release 별 crash-free session % 와 머지.
  const crashAnalytics = useMemo(() => {
    let js = 0;
    let nativeCount = 0;
    let jsUsers = 0;
    let nativeUsers = 0;
    for (const e of mockAppErrors) {
      if (e.error_type.startsWith("JS_")) {
        js += e.count;
        jsUsers += e.affected_users;
      } else if (e.error_type.startsWith("Native_")) {
        nativeCount += e.count;
        nativeUsers += e.affected_users;
      }
    }
    const total = js + nativeCount;
    const jsPct = total > 0 ? (js / total) * 100 : 0;
    const nativePct = total > 0 ? (nativeCount / total) * 100 : 0;
    // crash-free session rate (mock — Sentry 연동 시 release health 에서 가져옴).
    // 가정: DAU 12,840 · 24h crash 영향 사용자 (jsUsers + nativeUsers) → 일일 1세션 기준.
    const dailySessions = 12_840;
    const crashFreePct =
      dailySessions > 0
        ? ((dailySessions - (jsUsers + nativeUsers)) / dailySessions) * 100
        : 100;
    return { js, nativeCount, jsUsers, nativeUsers, jsPct, nativePct, crashFreePct };
  }, []);

  async function runAction(row: AppErrorRow, kind: "create_issue" | "mark_resolved" | "force_update_hint") {
    const labels = {
      create_issue: "Sentry 이슈 생성",
      mark_resolved: "해결됨 처리",
      force_update_hint: "버전 강제 업데이트 안내",
    } as const;
    const reason = window.prompt(`${labels[kind]} 사유 (5자 이상, 감사 로그에 기록).`);
    if (!reason || reason.trim().length < 5) {
      setToast("사유가 5자 이상 필요합니다.");
      return;
    }
    // 운영자 액션이므로 일시 실패는 silent retry.
    const result = await recordOpsAuditWithSilentRetry({
      action: `app.${kind}`,
      target_label: `${row.platform} v${row.app_version} · ${row.error_type}`,
      target_id: row.id,
      reason: reason.trim(),
      operator: "(현재 운영자 세션)",
      outcome: "queued",
    });
    setAuditTick((t) => t + 1);
    if (result.ok) {
      setToast(`${labels[kind]} 요청을 audit trail 에 기록했습니다.`);
    } else {
      setToast(`${labels[kind]} 큐 적재 최종 실패 — 운영자 확인 필요. [${result.attempts}회 시도]`);
    }
  }

  const columns: Column<AppErrorRow>[] = [
    { key: "platform", header: "OS", render: (r) => <span className={platformChip[r.platform]}>{r.platform === "ios" ? "iOS" : "Android"}</span> },
    {
      key: "type",
      header: "유형 / 운영자 라벨",
      render: (r) => {
        const entry = lookupErrorCode(r.error_type);
        return (
          <div className="min-w-0">
            <div className="font-mono text-xs font-medium text-slate-800">{r.error_type}</div>
            <div className="text-[11px] text-slate-600 truncate max-w-[240px]">
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
        const v = lookupErrorCode(r.error_type).userVisibility;
        return (
          <span className={USER_VISIBILITY_CHIP[v]} title={USER_VISIBILITY_LABEL[v]}>
            {USER_VISIBILITY_LABEL[v]}
          </span>
        );
      },
    },
    { key: "ver", header: "앱 버전", render: (r) => <span className="chip chip-muted">v{r.app_version}</span> },
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

      {/* 출시준비 라운드 §6 — Crash analytics (JS vs Native + crash-free + Sentry 연동 자리). */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="JS crash (24h)"
          value={crashAnalytics.js.toLocaleString()}
          delta={`${crashAnalytics.jsPct.toFixed(0)}%`}
          deltaTone="flat"
          hint={`${crashAnalytics.jsUsers}명 영향`}
          accent="purple"
        />
        <StatCard
          label="Native crash (24h)"
          value={crashAnalytics.nativeCount.toLocaleString()}
          delta={`${crashAnalytics.nativePct.toFixed(0)}%`}
          deltaTone="flat"
          hint={`${crashAnalytics.nativeUsers}명 영향`}
          accent="pink"
        />
        <StatCard
          label="Crash-free session"
          value={`${crashAnalytics.crashFreePct.toFixed(2)}%`}
          delta={crashAnalytics.crashFreePct >= 99.5 ? "정상" : "주의"}
          deltaTone={crashAnalytics.crashFreePct >= 99.5 ? "up" : "down"}
          hint="DAU 12,840 기준 (mock)"
          accent={crashAnalytics.crashFreePct >= 99.5 ? "teal" : "pink"}
        />
        <StatCard
          label="Sentry 연동"
          value="미연동"
          delta="자리만 확보"
          deltaTone="flat"
          hint="Server P1 후속 (DSN + release tag)"
          accent="orange"
        />
      </section>

      <PanelCard
        title="앱 크래시 / 런타임 에러"
        description="RN Expo 앱(iOS·Android)에서 보고된 크래시와 unhandled exception. error_type → 카탈로그 라벨."
        actions={
          <>
            <input
              className="input max-w-[220px]"
              placeholder="유형·메시지·기기 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
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
            <button
              className="btn-outline text-sm"
              type="button"
              onClick={() => exportCsv(exportColumns, filtered, `app-errors-${isoDateStamp()}.csv`)}
            >
              CSV
            </button>
            <button
              className="btn-outline text-sm"
              type="button"
              onClick={() => exportJson(exportColumns, filtered, `app-errors-${isoDateStamp()}.json`)}
            >
              JSON
            </button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="조건에 맞는 앱 에러가 없습니다." />
      </PanelCard>

      <OpsAuditTrailPanel
        prefix="app."
        title="앱 운영자 액션 audit (세션)"
        description="Sentry 이슈 생성·해결 처리·강제 업데이트 안내 등 운영자 액션 기록."
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
          onAction={(kind) => runAction(picked, kind)}
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
  err: AppErrorRow;
  onClose: () => void;
  onAction: (kind: "create_issue" | "mark_resolved" | "force_update_hint") => void;
}) {
  const entry = lookupErrorCode(err.error_type);
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
        <p className="text-xs text-muted mt-0.5">{err.id} · <span className="font-mono">{err.error_type}</span></p>

        <div className="mt-5 space-y-3 text-sm">
          <div className="rounded-xl bg-slate-900/85 text-white p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap break-words">
            {err.message}
          </div>
          <RowBlock label="카테고리" value={CATEGORY_LABEL[entry.category]} />
          <RowBlock
            label="사용자 인지"
            value={
              <span className={USER_VISIBILITY_CHIP[entry.userVisibility]}>
                {USER_VISIBILITY_LABEL[entry.userVisibility]}
              </span>
            }
          />
          <RowBlock label="플랫폼" value={err.platform === "ios" ? "iOS" : "Android"} />
          <RowBlock label="앱 버전" value={`v${err.app_version}`} />
          <RowBlock label="OS 버전" value={err.os_version} />
          <RowBlock label="기기" value={err.device_model} />
          <RowBlock label="영향 사용자" value={`${err.affected_users}명`} />
          <RowBlock label="발생 횟수" value={err.count.toLocaleString()} />
          <RowBlock label="최초" value={formatDate(err.first_seen)} />
          <RowBlock label="최근" value={formatDate(err.last_seen)} />
        </div>

        <div className="rounded-xl bg-white/60 border border-white/60 p-3 mt-3">
          <div className="text-xs text-muted mb-1">권장 조치</div>
          <p className="text-sm text-slate-800">{entry.recommendedAction}</p>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-outline text-sm" type="button" onClick={() => onAction("create_issue")}>
            이슈 생성
          </button>
          <button className="btn-outline text-sm" type="button" onClick={() => onAction("mark_resolved")}>
            해결됨 처리
          </button>
          <button className="btn-outline text-sm col-span-2" type="button" onClick={() => onAction("force_update_hint")}>
            강제 업데이트 안내 발송
          </button>
        </div>
        <p className="text-[11px] text-muted mt-3">※ 액션은 세션 audit trail 에 기록됩니다. 실제 Sentry 연동은 백엔드 작업 후.</p>
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
