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
  const [editing, setEditing] = useState<NoticeRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  // 게시 중지/재개 토글을 세션 내 로컬 상태로 반영 — 백엔드 미연동.
  // TODO(server-wire-up): `/api/v1/admin/notices/:id` PATCH 연동 후 server 상태로 교체.
  const [activeOverrides, setActiveOverrides] = useState<Record<string, boolean>>({});

  const notices = useMemo(
    () =>
      mockNotices.map((n) => ({
        ...n,
        active: activeOverrides[n.id] ?? n.active,
      })),
    [activeOverrides],
  );

  function toggleActive(notice: NoticeRow) {
    const next = !notice.active;
    setActiveOverrides((prev) => ({ ...prev, [notice.id]: next }));
    setToast(
      `"${notice.title}" 을(를) ${next ? "다시 게시했습니다" : "게시 중지했습니다"}. (백엔드 연동 후 영구 반영)`,
    );
  }

  const filtered = useMemo(
    () =>
      notices.filter((n) => {
        if (kind !== "all" && n.kind !== kind) return false;
        if (!showInactive && !n.active) return false;
        return true;
      }),
    [notices, kind, showInactive],
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
      render: (r) => (
        <div className="flex justify-end gap-1">
          <button
            className="btn-outline text-xs"
            type="button"
            onClick={() => setEditing(r)}
          >
            편집
          </button>
          <button
            className="btn-outline text-xs"
            type="button"
            onClick={() => toggleActive(r)}
          >
            {r.active ? "중지" : "재개"}
          </button>
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
          {notices.filter((n) => n.kind === "banner" && n.active).map((b) => (
            <div key={b.id} className="rounded-2xl p-5 bg-gradient-to-br from-accent/30 via-accentPink/20 to-accentBlue/20 border border-white/60">
              <span className="chip chip-info">{audienceLabel[b.audience]}</span>
              <h3 className="mt-2 text-base font-bold text-slate-900">{b.title}</h3>
              <p className="mt-1 text-sm text-slate-700">{b.body}</p>
              <p className="mt-3 text-[11px] text-muted">{formatDate(b.starts_at)} ~ {b.ends_at ? formatDate(b.ends_at) : "무기한"}</p>
            </div>
          ))}
        </div>
      </PanelCard>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card max-w-md">
          {toast}
          <button className="ml-3 underline opacity-80" onClick={() => setToast(null)} type="button">
            닫기
          </button>
        </div>
      ) : null}

      {composing ? (
        <ComposerModal
          onClose={() => setComposing(false)}
          onSaved={(title) => {
            setComposing(false);
            setToast(`"${title}" 등록 요청을 기록했습니다. (백엔드 연동 후 게시)`);
          }}
        />
      ) : null}
      {editing ? (
        <ComposerModal
          notice={editing}
          onClose={() => setEditing(null)}
          onSaved={(title) => {
            setEditing(null);
            setToast(`"${title}" 수정 사항을 기록했습니다. (백엔드 연동 후 반영)`);
          }}
        />
      ) : null}
    </div>
  );
}

// ComposerModal — 신규 등록 + 기존 공지/배너 편집 겸용. notice prop 이 있으면 편집 모드.
function ComposerModal({
  notice,
  onClose,
  onSaved,
}: {
  notice?: NoticeRow;
  onClose: () => void;
  onSaved: (title: string) => void;
}) {
  const isEdit = Boolean(notice);
  const [kind, setKind] = useState<NoticeRow["kind"]>(notice?.kind ?? "notice");
  const [title, setTitle] = useState(notice?.title ?? "");
  const [body, setBody] = useState(notice?.body ?? "");
  const [audience, setAudience] = useState<NoticeRow["audience"]>(notice?.audience ?? "all");
  const [startsAt, setStartsAt] = useState(
    notice?.starts_at ? notice.starts_at.slice(0, 10) : "",
  );
  const [pinned, setPinned] = useState(notice?.pinned ?? false);
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (!title.trim()) {
      setError("제목을 입력하세요.");
      return;
    }
    if (!body.trim()) {
      setError("본문을 입력하세요.");
      return;
    }
    setError(null);
    // TODO(server-wire-up): `/api/v1/admin/notices` POST/PATCH 연동.
    onSaved(title.trim());
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
        <h3 className="text-lg font-bold text-slate-900">
          {isEdit ? "공지/배너 편집" : "새 공지/배너 등록"}
        </h3>
        <p className="text-xs text-muted">
          {isEdit ? "기존 항목을 수정합니다." : "신규 공지 또는 메인 배너를 등록합니다."} 백엔드 연동 후 저장이 영구 반영됩니다.
        </p>

        <div className="mt-5 space-y-3">
          <label className="block text-xs text-slate-600">유형
            <select
              className="select mt-1"
              value={kind}
              onChange={(e) => setKind(e.target.value as NoticeRow["kind"])}
            >
              <option value="notice">공지</option>
              <option value="banner">배너</option>
            </select>
          </label>
          <label className="block text-xs text-slate-600">제목
            <input
              className="input mt-1"
              placeholder="예: 5/22 정기점검 안내"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={80}
            />
          </label>
          <label className="block text-xs text-slate-600">본문
            <textarea
              className="input mt-1 min-h-[100px]"
              placeholder="본문 내용"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={500}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs text-slate-600">대상
              <select
                className="select mt-1"
                value={audience}
                onChange={(e) => setAudience(e.target.value as NoticeRow["audience"])}
              >
                <option value="all">전체</option>
                <option value="premium">프리미엄</option>
                <option value="owners">인형 보유자</option>
              </select>
            </label>
            <label className="block text-xs text-slate-600">시작일
              <input
                className="input mt-1"
                type="date"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
              />
            </label>
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300"
              checked={pinned}
              onChange={(e) => setPinned(e.target.checked)}
            />
            상단 고정
          </label>
          {error ? (
            <p className="text-xs text-rose-600 bg-rose-50/80 border border-rose-200 rounded-xl px-3 py-2">
              {error}
            </p>
          ) : null}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button className="btn-outline text-sm" type="button" onClick={onClose}>취소</button>
          <button className="btn-primary text-sm" type="button" onClick={submit}>
            {isEdit ? "수정 저장" : "저장"}
          </button>
        </div>
      </div>
    </div>
  );
}
