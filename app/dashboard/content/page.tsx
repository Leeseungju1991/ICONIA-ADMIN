"use client";

// 콘텐츠 허브 — 피드 / 커머스 / 도감 세 표면의 진입점.

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../_components/PanelCard";
import { StatCard } from "../_components/StatCard";
import { EmptyState, FixtureBadge, LoadingState } from "../_components/CardStates";
import { authedFetchCount } from "@/lib/actions/contentCounts";

type Counts = {
  feed: number | null;
  commerce: number | null;
  info: number | null;
  source: "server" | "fixture" | null;
};

export default function ContentHubPage() {
  const [counts, setCounts] = useState<Counts>({ feed: null, commerce: null, info: null, source: null });
  const [loading, startLoad] = useTransition();

  function reload() {
    startLoad(async () => {
      const [f, c, i] = await Promise.all([
        authedFetchCount("feed"),
        authedFetchCount("commerce"),
        authedFetchCount("info"),
      ]);
      setCounts({
        feed: f.ok ? f.count : null,
        commerce: c.ok ? c.count : null,
        info: i.ok ? i.count : null,
        source: f.source ?? c.source ?? i.source ?? null,
      });
    });
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <StatCard
          label="커머스 상품"
          value={counts.commerce?.toLocaleString() ?? "—"}
          accent="teal"
        />
        <StatCard
          label="도감 항목"
          value={counts.info?.toLocaleString() ?? "—"}
          accent="orange"
        />
      </section>

      <PanelCard
        title="콘텐츠 진입"
        description="각 표면별 상세 페이지로 이동합니다."
        actions={
          <div className="flex items-center gap-2">
            {counts.source === "fixture" ? <FixtureBadge /> : null}
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
        {loading && counts.commerce === null ? (
          <LoadingState />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ContentTile
              title="커머스"
              hint="커머스 상품 가격 정보 — 추가·제거."
              count={counts.commerce}
              href="/dashboard/content/commerce"
            />
            <ContentTile
              title="도감"
              hint="인형 도감 항목 추가·제거."
              count={counts.info}
              href="/dashboard/content/catalog"
            />
          </div>
        )}
      </PanelCard>
    </div>
  );
}

function ContentTile({
  title,
  hint,
  count,
  href,
  disabled,
}: {
  title: string;
  hint: string;
  count: number | null;
  href: string;
  disabled?: boolean;
}) {
  const inner = (
    <div
      className={[
        "rounded-xl border px-4 py-3 transition",
        disabled
          ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed"
          : "border-slate-200 bg-white hover:border-accent hover:shadow-card",
      ].join(" ")}
    >
      <div className="flex items-center justify-between">
        <div className="font-semibold text-slate-900">{title}</div>
        <span className="text-2xl font-bold text-slate-900 tabular-nums">
          {count?.toLocaleString() ?? "—"}
        </span>
      </div>
      <div className="text-[11px] text-slate-500 mt-1">{hint}</div>
      {disabled ? (
        <div className="text-[10px] text-slate-400 mt-1">페이지 준비 중</div>
      ) : null}
    </div>
  );
  if (disabled) return inner;
  return <Link href={href}>{inner}</Link>;
}
