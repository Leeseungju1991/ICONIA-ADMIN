"use client";

import { useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { DataTable, type Column } from "../_components/DataTable";
import { mockNotices, formatDate, type NoticeRow } from "@/lib/mockData";

const audienceLabel: Record<NoticeRow["audience"], string> = {
  all: "전체",
  premium: "프리미엄",
  owners: "인형 보유자",
};

export default function NoticesPage() {
  const [kind, setKind] = useState<"all" | NoticeRow["kind"]>("all");
  const [showInactive, setShowInactive] = useState(true);
  const [composing, setComposing] = useState(false);

  const filtered = useMemo(
    () =>
      mockNotices.filter((n) => {
        if (kind !== "all" && n.kind !== kind) return false;
        if (!showInactive && !n.active) return false;
        return true;
      }),
    [kind, showInactive],
  );

  const columns: Column<NoticeRow>[] = [
    {
      key: "kind",
      header: "유형",
      render: (r) => (
        <span className={r.kind === "banner" ? "chip chip-info" : "chip chip-muted"}>
          {r.kind === "banner" ? "배너" : "공지"}
        </span>
      ),
    },
    {
      key: "title",
      header: "제목",
      render: (r) => (
        <div className="flex items-center gap-2 min-w-0">
          {r.pinned ? <span className="chip chip-warn">상단고정</span> : null}
          <span className="font-medium text-slate-800 truncate">{r.title}</span>
        </div>
      ),
    },
    { key: "audience", header: "대상", render: (r) => audienceLabel[r.audience] },
    { key: "state", header: "상태", render: (r) => (r.active ? <span className="chip chip-success">노출 중</span> : <span className="chip chip-muted">중지</span>) },
    { key: "starts", header: "시작", render: (r) => <span className="text-xs text-muted">{formatDate(r.starts_at)}</span> },
    { key: "ends", header: "종료", render: (r) => <span className="text-xs text-muted">{r.ends_at ? formatDate(r.ends_at) : "무기한"}</span> },
    {
      key: "actions",
      header: "",
      align: "right",
      render: () => (
        <div className="flex justify-end gap-1">
          <button className="btn-outline text-xs" type="button">편집</button>
          <button className="btn-outline text-xs" type="button">중지</button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PanelCard
        title="공지·배너 목록"
        description="인 앱/웹 공지와 메인 화면 배너를 등록·관리합니다."
        actions={
          <>
            <select
              className="select max-w-[140px]"
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="all">전체</option>
              <option value="notice">공지</option>
              <option value="banner">배너</option>
            </select>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-slate-300"
                checked={showInactive}
                onChange={(e) => setShowInactive(e.target.checked)}
              />
              비활성 포함
            </label>
            <button className="btn-primary text-sm" type="button" onClick={() => setComposing(true)}>
              + 새 등록
            </button>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="등록된 공지/배너가 없습니다." />
      </PanelCard>

      <PanelCard title="활성 배너 미리보기" description="현재 노출 중인 배너 카드">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {mockNotices.filter((n) => n.kind === "banner" && n.active).map((b) => (
            <div key={b.id} className="rounded-2xl p-5 bg-gradient-to-br from-accent/30 via-accentPink/20 to-accentBlue/20 border border-white/60">
              <span className="chip chip-info">{audienceLabel[b.audience]}</span>
              <h3 className="mt-2 text-base font-bold text-slate-900">{b.title}</h3>
              <p className="mt-1 text-sm text-slate-700">{b.body}</p>
              <p className="mt-3 text-[11px] text-muted">{formatDate(b.starts_at)} ~ {b.ends_at ? formatDate(b.ends_at) : "무기한"}</p>
            </div>
          ))}
        </div>
      </PanelCard>

      {composing ? <ComposerModal onClose={() => setComposing(false)} /> : null}
    </div>
  );
}

function ComposerModal({ onClose }: { onClose: () => void }) {
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
        <h3 className="text-lg font-bold text-slate-900">새 공지/배너 등록</h3>
        <p className="text-xs text-muted">데모 폼 — 백엔드 연동 시 저장 활성화됩니다.</p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-600">유형
            <select className="select mt-1">
              <option value="notice">공지</option>
              <option value="banner">배너</option>
            </select>
          </label>
          <label className="block text-xs text-slate-600">제목
            <input className="input mt-1" placeholder="예: 5/22 정기점검 안내" />
          </label>
          <label className="block text-xs text-slate-600">본문
            <textarea className="input mt-1 min-h-[100px]" placeholder="본문 내용" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-600">대상
              <select className="select mt-1">
                <option value="all">전체</option>
                <option value="premium">프리미엄</option>
                <option value="owners">인형 보유자</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">시작일
              <input className="input mt-1" type="date" />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" className="h-4 w-4 rounded border-slate-300" />
            상단 고정
          </label>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose}>취소</button>
          <button className="btn-primary text-sm" type="button">저장</button>
        </div>
      </div>
    </div>
  );
}
