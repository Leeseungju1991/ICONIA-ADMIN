"use client";

// (주)숨코리아 출시 정비 — 운영팀 수동 피드 게시물 작성 페이지.
//
// 흐름:
//   1. 작성자 UUID 입력 (또는 시스템 계정 검색)
//   2. 본문 입력 (최대 4000자, Markdown 미지원)
//   3. 미디어 drag-drop / 클릭 — per-file 즉시 업로드 (/api/admin/media/upload 프록시)
//   4. 모든 업로드 완료 후 발행 버튼 활성화
//   5. 발행 → SERVER `/api/v1/admin/feed/posts` POST → 목록 페이지 redirect + 토스트

import { useCallback, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelCard } from "../../_components/PanelCard";
import { createAdminFeedPostAction } from "@/lib/actions/adminFeedPostCreate";
import { adminErrorMessageKo, type AdminFeedPostMediaInput, type AdminMediaUploadResult } from "@/lib/adminApi";

const MAX_BODY = 4000;
const MAX_MEDIA = 10;
const ACCEPT_IMAGE = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ACCEPT_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];
const ACCEPT_ALL = [...ACCEPT_IMAGE, ...ACCEPT_VIDEO];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

type MediaItemState = {
  id: string;
  file: File;
  previewUrl: string;
  status: "uploading" | "done" | "error";
  progress: number; // 0~1
  errorMessage?: string;
  // 업로드 완료 후 SERVER 응답.
  uploaded?: AdminMediaUploadResult;
};

function genId(): string {
  // ID — 단순 timestamp + random. 충돌 무관 (브라우저 단일 세션).
  return `m_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function bytesToKb(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function classifyMimeBucket(mime: string): "image" | "video" | null {
  if (ACCEPT_IMAGE.includes(mime)) return "image";
  if (ACCEPT_VIDEO.includes(mime)) return "video";
  return null;
}

function validateFileLocally(f: File): string | null {
  const bucket = classifyMimeBucket(f.type);
  if (!bucket) return "허용되지 않는 형식입니다 (jpeg/png/webp/gif/mp4/webm/mov).";
  if (bucket === "image" && f.size > MAX_IMAGE_BYTES) return "이미지는 5 MB 이하여야 합니다.";
  if (bucket === "video" && f.size > MAX_VIDEO_BYTES) return "비디오는 50 MB 이하여야 합니다.";
  return null;
}

/**
 * 브라우저측 미디어 업로드 — XHR 로 /api/admin/media/upload 프록시 호출.
 * fetch 대신 XHR 인 이유: 본문 송신 progress 이벤트 (`xhr.upload.onprogress`) 가
 * 필요하기 때문. 응답은 표준 ServerEnvelope shape.
 */
function uploadFileXhr(
  file: File,
  onProgress: (ratio: number) => void,
): Promise<
  | { ok: true; data: AdminMediaUploadResult }
  | { ok: false; code?: string; message: string }
> {
  return new Promise((resolve) => {
    const fd = new FormData();
    fd.append("file", file, file.name);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/admin/media/upload");
    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && ev.total > 0) {
        onProgress(Math.min(1, ev.loaded / ev.total));
      }
    };
    xhr.onerror = () =>
      resolve({ ok: false, code: "ERR_NETWORK", message: "network_error" });
    xhr.ontimeout = () =>
      resolve({ ok: false, code: "ERR_NETWORK", message: "request_timeout" });
    xhr.onload = () => {
      let envelope: {
        ok?: boolean;
        data?: AdminMediaUploadResult;
        error?: { code: string; message: string };
      };
      try {
        envelope = JSON.parse(xhr.responseText);
      } catch {
        resolve({ ok: false, code: "ERR_INVALID_RESPONSE", message: "invalid_response" });
        return;
      }
      if (envelope?.ok === true && envelope.data) {
        resolve({ ok: true, data: envelope.data });
        return;
      }
      if (envelope?.error) {
        resolve({
          ok: false,
          code: envelope.error.code,
          message: envelope.error.message,
        });
        return;
      }
      resolve({ ok: false, code: "ERR_INVALID_RESPONSE", message: "invalid_response" });
    };
    xhr.timeout = 60_000;
    xhr.send(fd);
  });
}

export default function NewFeedPostPage() {
  const router = useRouter();
  const [authorId, setAuthorId] = useState("");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState<"published" | "draft" | "hidden">("published");
  const [reason, setReason] = useState("");
  const [mediaItems, setMediaItems] = useState<MediaItemState[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const anyUploading = mediaItems.some((m) => m.status === "uploading");
  const anyError = mediaItems.some((m) => m.status === "error");
  const completedCount = mediaItems.filter((m) => m.status === "done").length;

  const enqueueFiles = useCallback(
    (files: FileList | File[]) => {
      const arr = Array.from(files);
      setError(null);
      if (mediaItems.length + arr.length > MAX_MEDIA) {
        setError(`미디어는 최대 ${MAX_MEDIA}개까지 첨부할 수 있습니다.`);
        return;
      }
      const newItems: MediaItemState[] = [];
      for (const f of arr) {
        const ve = validateFileLocally(f);
        if (ve) {
          newItems.push({
            id: genId(),
            file: f,
            previewUrl: URL.createObjectURL(f),
            status: "error",
            progress: 0,
            errorMessage: ve,
          });
          continue;
        }
        newItems.push({
          id: genId(),
          file: f,
          previewUrl: URL.createObjectURL(f),
          status: "uploading",
          progress: 0,
        });
      }
      setMediaItems((prev) => [...prev, ...newItems]);
      // 즉시 업로드 시작 (per-file).
      for (const it of newItems) {
        if (it.status === "uploading") {
          void runUpload(it.id, it.file);
        }
      }
    },
    [mediaItems.length], // eslint-disable-line react-hooks/exhaustive-deps
  );

  async function runUpload(itemId: string, file: File) {
    const res = await uploadFileXhr(file, (ratio) => {
      setMediaItems((prev) =>
        prev.map((m) => (m.id === itemId ? { ...m, progress: ratio } : m)),
      );
    });
    if (!res.ok) {
      // 5xx/네트워크 → graceful: 입력값 보존 + 재시도 버튼.
      setMediaItems((prev) =>
        prev.map((m) =>
          m.id === itemId
            ? {
                ...m,
                status: "error",
                errorMessage: adminErrorMessageKo(res.code) || res.message,
              }
            : m,
        ),
      );
      return;
    }
    setMediaItems((prev) =>
      prev.map((m) =>
        m.id === itemId
          ? { ...m, status: "done", progress: 1, uploaded: res.data }
          : m,
      ),
    );
  }

  function retryUpload(itemId: string) {
    const it = mediaItems.find((m) => m.id === itemId);
    if (!it) return;
    setMediaItems((prev) =>
      prev.map((m) =>
        m.id === itemId
          ? { ...m, status: "uploading", progress: 0, errorMessage: undefined }
          : m,
      ),
    );
    void runUpload(itemId, it.file);
  }

  function removeMedia(itemId: string) {
    setMediaItems((prev) => {
      const it = prev.find((m) => m.id === itemId);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((m) => m.id !== itemId);
    });
  }

  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      enqueueFiles(e.dataTransfer.files);
    }
  }

  function clientValidate(): string | null {
    const fe: Record<string, string> = {};
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!authorId) fe.authorId = "작성자 UUID 를 입력하세요.";
    else if (!UUID_RE.test(authorId)) fe.authorId = "UUID 형식이 아닙니다.";
    if (!body || body.trim().length === 0) fe.body = "본문을 입력하세요.";
    else if (body.length > MAX_BODY) fe.body = `본문은 ${MAX_BODY}자 이하로 입력하세요.`;
    if (!reason || reason.trim().length < 5)
      fe.reason = "운영자 사유는 5자 이상 입력하세요.";
    setFieldErrors(fe);
    if (Object.keys(fe).length > 0) return "입력값을 확인하세요.";
    if (anyUploading) return "미디어 업로드가 완료될 때까지 기다리세요.";
    if (anyError) return "업로드 실패한 미디어를 제거하거나 재시도하세요.";
    return null;
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const ve = clientValidate();
    if (ve) {
      setError(ve);
      return;
    }
    const media: AdminFeedPostMediaInput[] = mediaItems
      .filter((m) => m.status === "done" && m.uploaded)
      .map((m) => {
        const u = m.uploaded!;
        const type: "image" | "video" = u.mimeType.startsWith("video/") ? "video" : "image";
        return {
          url: u.url,
          type,
          ...(u.thumbnailUrl ? { thumbnailUrl: u.thumbnailUrl } : {}),
          ...(typeof u.durationSec === "number" ? { durationSec: u.durationSec } : {}),
          ...(typeof u.width === "number" ? { width: u.width } : {}),
          ...(typeof u.height === "number" ? { height: u.height } : {}),
        };
      });
    startTransition(async () => {
      const res = await createAdminFeedPostAction({
        authorId,
        body,
        media,
        status,
        reason: reason.trim(),
      });
      if (!res.ok) {
        if (
          res.code === "ERR_SERVER_UNAVAILABLE" ||
          res.code === "ERR_NETWORK" ||
          res.code === "ERR_INVALID_RESPONSE"
        ) {
          setError("Server 준비 중입니다. 입력값을 보존했으니 잠시 후 다시 시도하세요.");
          return;
        }
        setError(adminErrorMessageKo(res.code) || res.message);
        return;
      }
      router.push(`/dashboard/feed?created=${encodeURIComponent(res.data.post.id)}`);
    });
  }

  return (
    <div className="space-y-6">
      <PanelCard
        title="새 피드 게시물"
        description="운영팀이 직접 피드 게시물을 발행합니다. 미디어는 사전에 업로드합니다."
        actions={
          <Link href="/dashboard/feed" className="btn-outline text-xs">
            ← 피드 목록
          </Link>
        }
      >
        {error ? (
          <div
            role="alert"
            className="mb-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </div>
        ) : null}

        <form className="grid grid-cols-1 gap-4" onSubmit={submit}>
          <Field label="작성자 (UUID)" error={fieldErrors.authorId} required>
            <input
              type="text"
              className="input w-full font-mono"
              value={authorId}
              onChange={(e) => setAuthorId(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000000"
              spellCheck={false}
              required
            />
            <p className="text-[11px] text-muted mt-1">
              기존 사용자 UUID 입력 또는 사용자 목록에서 복사. (autocomplete 는 다음 라운드)
            </p>
          </Field>

          <Field label="본문" error={fieldErrors.body} required>
            <textarea
              className="input w-full min-h-[160px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={MAX_BODY}
              placeholder="피드 본문을 입력하세요 (Markdown 미지원, 일반 텍스트만)"
              required
            />
            <p className="text-[11px] text-muted mt-1">
              {body.length} / {MAX_BODY} — Markdown 미지원, 일반 텍스트만 표시됩니다.
            </p>
          </Field>

          <div>
            <label className="block text-xs text-muted mb-1">
              미디어 (이미지/비디오, 최대 {MAX_MEDIA}개)
            </label>
            <div
              role="button"
              tabIndex={0}
              data-testid="media-dropzone"
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={onDrop}
              className={`rounded-2xl border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? "border-accent bg-accent/10"
                  : "border-slate-300 bg-white/40 hover:bg-white/60"
              }`}
            >
              <p className="text-sm text-slate-700">
                이곳에 끌어다 놓거나 클릭하여 선택
              </p>
              <p className="text-[11px] text-muted mt-1">
                이미지 ≤ 5 MB · 비디오 ≤ 50 MB · jpeg/png/webp/gif/mp4/webm/mov
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPT_ALL.join(",")}
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) enqueueFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </div>

            {mediaItems.length > 0 ? (
              <ul className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {mediaItems.map((m) => (
                  <li
                    key={m.id}
                    className="rounded-xl border border-white/60 bg-white/55 p-2 text-xs"
                  >
                    <div className="aspect-video bg-slate-100 rounded-md overflow-hidden flex items-center justify-center mb-2">
                      {classifyMimeBucket(m.file.type) === "image" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.previewUrl}
                          alt={m.file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <video
                          src={m.previewUrl}
                          className="w-full h-full object-cover"
                          muted
                          preload="metadata"
                        />
                      )}
                    </div>
                    <div className="truncate font-mono text-[11px]">{m.file.name}</div>
                    <div className="text-muted text-[10px]">
                      {bytesToKb(m.file.size)} · {m.file.type}
                    </div>
                    {m.status === "uploading" ? (
                      <div className="mt-1">
                        <div className="h-1 bg-slate-200 rounded overflow-hidden">
                          <div
                            className="h-full bg-accent transition-all"
                            style={{ width: `${Math.round(m.progress * 100)}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-muted mt-0.5">
                          업로드 중 {Math.round(m.progress * 100)}%
                        </div>
                      </div>
                    ) : null}
                    {m.status === "done" ? (
                      <div className="mt-1 text-[10px] text-emerald-700">업로드 완료</div>
                    ) : null}
                    {m.status === "error" ? (
                      <div className="mt-1 text-[10px] text-red-700">
                        {m.errorMessage ?? "업로드 실패"}
                      </div>
                    ) : null}
                    <div className="flex gap-1 mt-2">
                      {m.status === "error" ? (
                        <button
                          type="button"
                          onClick={() => retryUpload(m.id)}
                          className="rounded-md bg-amber-100 border border-amber-200 text-amber-800 text-[10px] px-2 py-0.5"
                        >
                          재시도
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => removeMedia(m.id)}
                        className="rounded-md bg-white/70 border border-white/70 text-slate-600 text-[10px] px-2 py-0.5"
                      >
                        제거
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-[11px] text-muted mt-2">
              완료 {completedCount} / {mediaItems.length}
              {anyUploading ? " · 업로드 진행 중" : ""}
              {anyError ? " · 실패 항목 있음" : ""}
            </p>
          </div>

          <Field label="상태" error={fieldErrors.status}>
            <select
              className="select w-full"
              value={status}
              onChange={(e) => setStatus(e.target.value as typeof status)}
            >
              <option value="published">공개 (published)</option>
              <option value="draft">임시 저장 (draft)</option>
              <option value="hidden">숨김 (hidden)</option>
            </select>
          </Field>

          <Field label="운영자 사유 (5~256자)" error={fieldErrors.reason} required>
            <textarea
              className="input w-full min-h-[80px]"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={256}
              placeholder="예: 공식 공지 안내 / 이벤트 결과 발표"
              required
            />
            <p className="text-[11px] text-muted mt-1">
              {reason.length} / 256 — 감사 로그에 기록됩니다.
            </p>
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Link href="/dashboard/feed" className="btn-outline text-sm">
              취소
            </Link>
            <button
              type="submit"
              className="btn-primary text-sm disabled:opacity-60"
              disabled={pending || anyUploading}
              data-testid="submit-post"
            >
              {pending
                ? "발행 중..."
                : anyUploading
                  ? "미디어 업로드 완료 후 발행 가능"
                  : "게시물 발행"}
            </button>
          </div>
        </form>
      </PanelCard>
    </div>
  );
}

function Field({
  label,
  children,
  error,
  required,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1">
        {label}
        {required ? <span className="text-red-600 ml-0.5">*</span> : null}
      </label>
      {children}
      {error ? <p className="text-xs text-red-700 mt-1">{error}</p> : null}
    </div>
  );
}
