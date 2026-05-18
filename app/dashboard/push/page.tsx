"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import { mockPush, formatDate, type PushRow } from "@/lib/mockData";

const audienceLabel: Record<PushRow["audience"], string> = {
  all: "전체",
  premium: "프리미엄",
  owners: "인형 보유자",
  inactive_7d: "7일 미접속",
};

const stateInfo: Record<PushRow["state"], { label: string; chip: string }> = {
  draft: { label: "임시저장", chip: "chip chip-muted" },
  scheduled: { label: "예약됨", chip: "chip chip-info" },
  sending: { label: "발송 중", chip: "chip chip-warn" },
  sent: { label: "발송완료", chip: "chip chip-success" },
  failed: { label: "실패", chip: "chip chip-error" },
};

export default function PushPage() {
  const [composing, setComposing] = useState(false);
  const [stateFilter, setStateFilter] = useState<"all" | PushRow["state"]>("all");

  const filtered = useMemo(
    () => mockPush.filter((p) => stateFilter === "all" || p.state === stateFilter),
    [stateFilter],
  );

  const summary = useMemo(() => {
    const sent = mockPush.filter((p) => p.state === "sent");
    const delivered = sent.reduce((s, p) => s + p.delivered, 0);
    const opened = sent.reduce((s, p) => s + p.opened, 0);
    const openRate = delivered > 0 ? `${((opened / delivered) * 100).toFixed(1)}%` : "—";
    const scheduled = mockPush.filter((p) => p.state === "scheduled").length;
    return { delivered, opened, openRate, scheduled };
  }, []);

  const columns: Column<PushRow>[] = [
    { key: "title", header: "제목", render: (r) => <span className="font-medium text-slate-800">{r.title}</span> },
    { key: "audience", header: "대상", render: (r) => <span className="chip chip-info">{audienceLabel[r.audience]}</span> },
    { key: "state", header: "상태", render: (r) => <span className={stateInfo[r.state].chip}>{stateInfo[r.state].label}</span> },
    { key: "schedule", header: "예약 시각", render: (r) => <span className="text-xs text-muted">{formatDate(r.scheduled_at)}</span> },
    { key: "sent", header: "발송 시각", render: (r) => <span className="text-xs text-muted">{r.sent_at ? formatDate(r.sent_at) : "—"}</span> },
    { key: "delivered", header: "도달", align: "right", render: (r) => r.delivered.toLocaleString() },
    {
      key: "open",
      header: "오픈율",
      align: "right",
      render: (r) => {
        if (r.delivered === 0) return "—";
        const pct = (r.opened / r.delivered) * 100;
        return `${pct.toFixed(1)}%`;
      },
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button className="btn-outline text-xs" type="button">복사</button>
          {r.state === "draft" || r.state === "scheduled" ? (
            <button className="btn-outline text-xs" type="button">편집</button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="총 도달 (완료된 캠페인)" value={summary.delivered.toLocaleString()} hint="누적" accent="blue" />
        <StatCard label="총 오픈" value={summary.opened.toLocaleString()} hint="누적" accent="pink" />
        <StatCard label="평균 오픈율" value={summary.openRate} hint="발송 완료 평균" accent="purple" />
        <StatCard label="예약된 캠페인" value={String(summary.scheduled)} hint="대기 중" accent="teal" />
      </section>

      <PanelCard
        title="푸시 캠페인"
        description="앱 푸시 알림 캠페인을 작성·예약·발송하고 결과를 모니터링합니다."
        actions={
          <>
            <select
              className="select max-w-[160px]"
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value as typeof stateFilter)}
            >
              <option value="all">전체 상태</option>
              <option value="draft">임시저장</option>
              <option value="scheduled">예약됨</option>
              <option value="sending">발송 중</option>
              <option value="sent">완료</option>
              <option value="failed">실패</option>
            </select>
            <button className="btn-primary text-sm" type="button" onClick={() => setComposing(true)}>
              + 새 캠페인
            </button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="해당 상태의 캠페인이 없습니다." />
      </PanelCard>

      {composing ? <PushComposer onClose={() => setComposing(false)} /> : null}
    </div>
  );
}

function PushComposer({ onClose }: { onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
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
        <h3 className="text-lg font-bold text-slate-900">새 푸시 캠페인</h3>

        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-600">제목
            <input className="input mt-1" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="알림 제목" maxLength={50} />
          </label>
          <label className="block text-xs text-slate-600">본문
            <textarea className="input mt-1 min-h-[100px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="알림 본문" maxLength={200} />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-600">대상
              <select className="select mt-1">
                <option value="all">전체</option>
                <option value="premium">프리미엄</option>
                <option value="owners">인형 보유자</option>
                <option value="inactive_7d">7일 미접속</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">예약 시각
              <input className="input mt-1" type="datetime-local" />
            </label>
          </div>

          <div className="rounded-2xl bg-white/55 border border-white/60 p-3">
            <div className="text-xs text-muted mb-2">📱 미리보기</div>
            <div className="rounded-xl bg-slate-900/85 text-white p-3 text-sm">
              <div className="text-[11px] text-white/70">ICONIA</div>
              <div className="font-semibold">{title || "알림 제목"}</div>
              <div className="text-xs text-white/85">{body || "알림 본문이 표시됩니다."}</div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose}>취소</button>
          <button className="btn-outline text-sm" type="button">임시저장</button>
          <button className="btn-primary text-sm" type="button">예약 발송</button>
        </div>
      </div>
    </div>
  );
}
