"use client";

// 2026-05-27 — 오류 추적 (기능별).

import { useEffect, useMemo, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import { EmptyState, ErrorState, FixtureBadge, LoadingState } from "../_components/CardStates";
import { listErrorsAction } from "@/lib/actions/errorsTracking";
import type { ErrorDomain, ErrorRow } from "@/types/admin-api";

const DOMAIN_LABEL: Record<ErrorDomain, string> = {
  firmware: "펌웨어",
  server: "서버",
  ai: "AI",
  app: "앱",
};

const DOMAIN_ACCENT: Record<ErrorDomain, "blue" | "pink" | "orange" | "teal"> = {
  firmware: "blue",
  server: "orange",
  ai: "teal",
  app: "pink",
};

const SEVERITY_CHIP: Record<ErrorRow["severity"], string> = {
  critical: "chip chip-error",
  high: "chip chip-error",
  medium: "chip chip-warn",
  low: "chip chip-muted",
};

const SEVERITY_LABEL: Record<ErrorRow["severity"], string> = {
  critical: "긴급",
  high: "높음",
  medium: "보통",
  low: "낮음",
};

export default function ErrorTrackingPage() {
  const [domain, setDomain] = useState<ErrorDomain>("server");
  const [items, setItems] = useState<ErrorRow[]>([]);
  const [error, setError] = useState<{ message: string; unreachable: boolean } | null>(null);
  const [source, setSource] = useState<"server" | "fixture" | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const r = await listErrorsAction({ domain, since });
      if (!r.ok) {
        setError({ message: r.message, unreachable: !!r.unreachable });
        setItems([]);
        return;
      }
      setError(null);
      setItems(r.data.items);
      setSource(r.source);
    });
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain]);

  const stats = useMemo(() => {
    const total = items.reduce((s, e) => s + e.count_24h, 0);
    const affected = items.reduce((s, e) => s + e.affected_users, 0);
    const critical = items.filter((e) => e.severity === "critical").length;
    const high = items.filter((e) => e.severity === "high").length;
    return { total, affected, critical, high };
  }, [items]);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={`${DOMAIN_LABEL[domain]} — 24h 합계`}
          value={stats.total.toLocaleString()}
          hint="이벤트 수"
          accent={DOMAIN_ACCENT[domain]}
        />
        <StatCard
          label="영향 사용자"
          value={stats.affected.toLocaleString()}
          hint="고유 사용자 (24h)"
          accent="orange"
        />
        <StatCard
          label="긴급"
          value={String(stats.critical)}
          delta={stats.critical > 0 ? "즉시 대응" : "없음"}
          deltaTone={stats.critical > 0 ? "down" : "up"}
          hint="긴급 수준의 오류"
          accent="pink"
        />
        <StatCard
          label="높음"
          value={String(stats.high)}
          hint="높음 수준의 오류"
          accent="blue"
        />
      </section>

      <PanelCard
        title="오류 추적 — 기능별"
        description="기능을 선택하여 최근 24시간 동안 발생한 오류를 확인합니다."
        actions={
          <div className="flex items-center gap-2">
            {source === "fixture" ? <FixtureBadge /> : null}
            <button
              type="button"
              onClick={reload}
              disabled={loading}
              className="rounded-lg bg-white border border-slate-300 px-3 py-1 text-xs hover:bg-slate-50 disabled:opacity-60"
            >
              {loading ? "조회 중..." : "새로고침"}
            </button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 mb-4">
          {(["firmware", "server", "ai", "app"] as ErrorDomain[]).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDomain(d)}
              className={[
                "rounded-full px-3.5 py-1.5 text-xs font-medium border transition",
                domain === d
                  ? "bg-accent text-white border-accent"
                  : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50",
              ].join(" ")}
            >
              {DOMAIN_LABEL[d]}
            </button>
          ))}
        </div>

        {error ? (
          <ErrorState message={error.message} unreachable={error.unreachable} onRetry={reload} />
        ) : loading && items.length === 0 ? (
          <LoadingState />
        ) : items.length === 0 ? (
          <EmptyState
            title="24h 내 에러 없음"
            hint={`${DOMAIN_LABEL[domain]} 도메인이 안정적입니다.`}
          />
        ) : (
          <ul className="space-y-2">
            {items.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={SEVERITY_CHIP[e.severity]}>{SEVERITY_LABEL[e.severity]}</span>
                      <span className="font-mono text-[11px] text-slate-500">
                        {e.fingerprint}
                      </span>
                      {e.source ? (
                        <span className="chip chip-muted">{e.source}</span>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm font-medium text-slate-800 truncate">
                      {e.message}
                    </p>
                    <div className="mt-1 text-[11px] text-slate-500">
                      24h {e.count_24h.toLocaleString()}회 · 영향 사용자 {e.affected_users.toLocaleString()}명
                      · 마지막 {new Date(e.last_seen_at).toLocaleString("ko-KR")}
                    </div>
                  </div>
                  {e.stack ? (
                    <button
                      type="button"
                      onClick={() => setExpanded(expanded === e.id ? null : e.id)}
                      className="rounded-lg bg-white border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-50 shrink-0"
                    >
                      {expanded === e.id ? "접기" : "스택"}
                    </button>
                  ) : null}
                </div>
                {expanded === e.id && e.stack ? (
                  <pre className="mt-2 rounded-lg bg-slate-900 text-slate-100 text-[11px] p-3 overflow-x-auto whitespace-pre-wrap">
                    {e.stack}
                  </pre>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </PanelCard>
    </div>
  );
}
