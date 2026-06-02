"use client";

import { useEffect, useState, useTransition } from "react";
import { PanelCard } from "../../_components/PanelCard";
import { LoadingState, EmptyState } from "../../_components/CardStates";
import { DangerConfirmDialog } from "../../_components/DangerConfirmDialog";
import {
  listBannersAction,
  createBannerAction,
  updateBannerAction,
  deleteBannerAction,
  type BannersListResult,
} from "@/lib/actions/commerceBanners";
import type { CommerceBannerRow } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";

// 2026-06-01 — 배너 CRUD. 이미지 업로드는 /api/admin/media/upload (XHR + progress).
// notices/page.tsx 패턴 + media upload progress.

type UploadState = "idle" | "uploading" | "ok" | "error";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const tz = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - tz).toISOString().slice(0, 16);
  } catch {
    return "";
  }
}

function localInputToIso(local: string): string | null {
  const v = local.trim();
  if (!v) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export default function BannersClient() {
  const [state, setState] = useState<BannersListResult | null>(null);
  const [loading, startLoad] = useTransition();
  const [mutating, startMutate] = useTransition();
  const [toast, setToast] = useState<string | null>(null);

  // 신규 배너 폼.
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [orderIdx, setOrderIdx] = useState(0);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [active, setActive] = useState(true);
  const [linkType, setLinkType] = useState("none");
  const [linkTarget, setLinkTarget] = useState("");

  // 업로드 진행률.
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [uploadRatio, setUploadRatio] = useState(0);

  // V1.0 라운드 — window.confirm → DangerConfirmDialog 정합.
  // 모달은 단일 인스턴스. pendingDeleteId 가 곧 표시 트리거 + 확정 시 사용할 인자.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteTitle =
    pendingDeleteId && state && state.ok
      ? state.items.find((it) => it.id === pendingDeleteId)?.title ?? null
      : null;

  function reload() {
    startLoad(async () => {
      const r = await listBannersAction();
      setState(r);
    });
  }

  useEffect(() => {
    reload();
  }, []);

  function resetForm() {
    setTitle("");
    setImageUrl("");
    setOrderIdx(0);
    setStartsAt("");
    setEndsAt("");
    setActive(true);
    setLinkType("none");
    setLinkTarget("");
    setUploadState("idle");
    setUploadRatio(0);
  }

  async function handleUpload(file: File) {
    setUploadState("uploading");
    setUploadRatio(0);

    // XHR 로 progress 추적 — fetch 는 본문 송신 progress 미지원.
    await new Promise<void>((resolve) => {
      try {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/admin/media/upload");
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && e.total > 0) {
            setUploadRatio(e.loaded / e.total);
          }
        };
        xhr.onload = () => {
          try {
            const body = JSON.parse(xhr.responseText);
            if (body?.ok === true && body?.data?.url) {
              setImageUrl(String(body.data.url));
              setUploadState("ok");
              setUploadRatio(1);
            } else {
              const code = body?.error?.code ?? "ERR_INTERNAL";
              setToast(`업로드 실패: ${messageForCode(code, body?.error?.message)}`);
              setUploadState("error");
            }
          } catch {
            setToast("업로드 응답 해석 실패");
            setUploadState("error");
          }
          resolve();
        };
        xhr.onerror = () => {
          setToast("업로드 네트워크 오류");
          setUploadState("error");
          resolve();
        };
        const fd = new FormData();
        fd.append("file", file);
        xhr.send(fd);
      } catch {
        setUploadState("error");
        resolve();
      }
    });
  }

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !imageUrl.trim()) {
      setToast("타이틀 + 이미지 URL 필수");
      return;
    }
    startMutate(async () => {
      const r = await createBannerAction({
        title: title.trim(),
        image_url: imageUrl.trim(),
        link_type: linkType,
        link_target: linkTarget.trim() || null,
        order_idx: orderIdx,
        is_published: active,
        starts_at: localInputToIso(startsAt),
        ends_at: localInputToIso(endsAt),
      });
      if (!r.ok) {
        setToast(`작성 실패: ${messageForCode(r.code, r.message)}`);
        return;
      }
      setToast(`배너 작성됨: ${r.banner.id}`);
      resetForm();
      reload();
    });
  }

  function toggleActive(row: CommerceBannerRow) {
    startMutate(async () => {
      const r = await updateBannerAction({
        id: row.id,
        patch: { is_published: !row.is_published },
      });
      if (!r.ok) {
        setToast(`수정 실패: ${messageForCode(r.code, r.message)}`);
        return;
      }
      setToast("상태 변경됨");
      reload();
    });
  }

  function handleDelete(id: string) {
    // 강력액션 정합 라운드 — window.confirm 대신 DangerConfirmDialog 트리거.
    setPendingDeleteId(id);
  }

  function confirmDelete() {
    const id = pendingDeleteId;
    if (!id) return;
    setPendingDeleteId(null);
    startMutate(async () => {
      const r = await deleteBannerAction({ id });
      if (!r.ok) {
        setToast(`삭제 실패: ${messageForCode(r.code, r.message)}`);
        return;
      }
      setToast("배너 삭제됨");
      reload();
    });
  }

  const items: CommerceBannerRow[] = state && state.ok ? state.items : [];

  return (
    <div className="space-y-6">
      <PanelCard title="배너 작성" description="이미지는 5MB, 비디오는 50MB 까지 업로드할 수 있습니다.">
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="타이틀"
              required
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={orderIdx}
              onChange={(e) => setOrderIdx(Number(e.target.value) || 0)}
              placeholder="정렬 idx"
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-3 space-y-2">
            <div className="flex items-center gap-2">
              <input
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="이미지 URL (또는 파일 업로드)"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
              />
              <label className="rounded-lg bg-slate-900 text-white text-xs px-3 py-2 cursor-pointer">
                업로드
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.currentTarget.files?.[0];
                    if (f) handleUpload(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            {uploadState === "uploading" ? (
              <div className="h-1 rounded-full bg-slate-200 overflow-hidden">
                <div
                  className="h-full bg-accent transition-all"
                  style={{ width: `${Math.round(uploadRatio * 100)}%` }}
                />
              </div>
            ) : uploadState === "ok" ? (
              <div className="text-[11px] text-emerald-700">업로드 완료 — URL 자동 반영됨</div>
            ) : null}
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="배너 미리보기"
                className="max-h-32 rounded-lg border border-slate-200 object-cover"
              />
            ) : null}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs text-muted mb-1">visible_from</span>
              <input
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted mb-1">visible_until</span>
              <input
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <select
              value={linkType}
              onChange={(e) => setLinkType(e.target.value)}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="none">링크 없음</option>
              <option value="product">product</option>
              <option value="category">category</option>
              <option value="url">url</option>
            </select>
            <input
              value={linkTarget}
              onChange={(e) => setLinkTarget(e.target.value)}
              placeholder="link target (id 또는 URL)"
              className="sm:col-span-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
              />
              active
            </label>
            <button
              type="submit"
              disabled={mutating}
              className="rounded-xl bg-accent px-4 py-2 text-sm text-white shadow-card disabled:opacity-60"
            >
              {mutating ? "작성 중..." : "작성"}
            </button>
          </div>
        </form>
      </PanelCard>

      <PanelCard
        title="배너 목록"
        actions={
          <button
            type="button"
            onClick={reload}
            disabled={loading}
            className="rounded-xl bg-white px-3 py-1.5 text-xs text-slate-700 border border-slate-300"
          >
            {loading ? "조회 중..." : "새로고침"}
          </button>
        }
      >
        {!state ? (
          <LoadingState />
        ) : !state.ok ? (
          <EmptyState
            title="조회할 수 없음"
            hint={messageForCode(state.code, state.message)}
          />
        ) : items.length === 0 ? (
          <EmptyState title="등록된 배너가 없습니다." />
        ) : (
          <div className="scroll-x-touch">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="text-left text-[11px] text-muted">
                  <th className="px-2 py-1">이미지</th>
                  <th className="px-2 py-1">title</th>
                  <th className="px-2 py-1">order</th>
                  <th className="px-2 py-1">visible_from</th>
                  <th className="px-2 py-1">visible_until</th>
                  <th className="px-2 py-1">active</th>
                  <th className="px-2 py-1">액션</th>
                </tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.id} className="border-t border-slate-100 align-middle">
                    <td className="px-2 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={b.image_url}
                        alt={b.title}
                        className="h-12 w-20 rounded-md object-cover border border-slate-200"
                      />
                    </td>
                    <td className="px-2 py-2 max-w-[200px]">
                      <div className="font-medium text-slate-800 truncate">{b.title}</div>
                      <div className="text-[10px] text-muted truncate">
                        {b.link_type} {b.link_target ? `→ ${b.link_target}` : ""}
                      </div>
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{b.order_idx}</td>
                    <td className="px-2 py-2 text-xs text-muted whitespace-nowrap">
                      {toLocalInput(b.starts_at) || "—"}
                    </td>
                    <td className="px-2 py-2 text-xs text-muted whitespace-nowrap">
                      {toLocalInput(b.ends_at) || "—"}
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => toggleActive(b)}
                        className={
                          b.is_published
                            ? "chip chip-success"
                            : "chip chip-muted"
                        }
                      >
                        {b.is_published ? "active" : "inactive"}
                      </button>
                    </td>
                    <td className="px-2 py-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(b.id)}
                        className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl bg-slate-900/85 text-white text-sm px-4 py-3 shadow-card">
          {toast}
          <button
            className="ml-3 underline opacity-80"
            onClick={() => setToast(null)}
            type="button"
          >
            닫기
          </button>
        </div>
      ) : null}

      <DangerConfirmDialog
        open={pendingDeleteId !== null}
        title="배너 삭제"
        description="배너를 비공개(삭제) 처리합니다. 노출 중이라면 즉시 사라집니다."
        detail={
          pendingDeleteTitle ? (
            <span>대상: <b>{pendingDeleteTitle}</b></span>
          ) : (
            <span>대상 id: <code className="font-mono">{pendingDeleteId}</code></span>
          )
        }
        confirmLabel="삭제"
        busy={mutating}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDeleteId(null)}
      />
    </div>
  );
}
