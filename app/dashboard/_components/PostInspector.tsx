"use client";
import Link from "next/link";
import type { FeedPost } from "@/lib/mockFeed";
import type { OperatorRole } from "@/lib/operatorRoles";

// 권한 위계 (낮은 → 높은). UserSnapshotGrid 와 동일 패턴.
const ORDER: OperatorRole[] = ["viewer", "cs", "secops", "sre", "superadmin"];
const allow = (r: OperatorRole, m: OperatorRole) => ORDER.indexOf(r) >= ORDER.indexOf(m);

// P0 보안 — 미디어 URL 프로토콜 화이트리스트 검사.
// post.media 는 서버/사용자 업로드 URL. CSP img-src 'self' data: https: 가 javascript:
// 등을 img 로딩 레벨에서 차단하지만, 운영자 콘솔에서는 추가 방어로 https: / data: / blob:
// 이외의 src 를 렌더하지 않는다. HTTP는 admin 이 HTTPS 단독 운영이므로 허용 X.
function isSafeMediaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "data:" || parsed.protocol === "blob:";
  } catch {
    return false;
  }
}

export type ModerationKey = "hide" | "unhide" | "takedown" | "hide_all_by_user";

export function PostInspector({ post, role, onAction }: {
  post: FeedPost | null;
  role: OperatorRole;
  onAction: (k: ModerationKey) => void;
}) {
  if (!post) return <div className="bg-white border border-slate-200 rounded-2xl p-6 text-sm text-muted">왼쪽 피드에서 게시물을 선택하세요</div>;
  return (
    <article className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
      <header className="flex items-start justify-between gap-3">
        <div>
          <Link href={`/dashboard/user-360?q=${encodeURIComponent(post.author_id)}`} className="text-sm font-semibold text-indigo-700 hover:underline">{post.author_name}</Link>
          <div className="text-[11px] text-muted">{new Date(post.created_at).toLocaleString()}</div>
        </div>
        <span className={`chip ${post.status === "visible" ? "chip-muted" : post.status === "hidden" ? "chip-warn" : "chip-error"}`}>{post.status}</span>
      </header>
      <p className="text-sm text-slate-800 whitespace-pre-line">{post.body}</p>
      {post.media.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto">
          {post.media.map((m) =>
            isSafeMediaUrl(m) ? (
              <img key={m} src={m} alt="" className="h-28 w-auto rounded-lg border border-slate-200" />
            ) : (
              <span key={m} className="inline-flex h-28 w-20 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-[10px] text-slate-400" title="지원하지 않는 미디어 URL">미지원 URL</span>
            )
          )}
        </div>
      ) : null}
      <section>
        <h4 className="text-xs font-semibold text-slate-700 mb-1">신고 이력 {post.reports.length}</h4>
        {post.reports.length === 0 ? <p className="text-[11px] text-muted">없음</p> : (
          <ul className="space-y-1">
            {post.reports.map((r, i) => (
              <li key={i} className="text-[11px] text-slate-700">
                <span className="chip chip-error mr-1">{r.reason}</span>
                {r.reporter_name} · {new Date(r.created_at).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h4 className="text-xs font-semibold text-slate-700 mb-1">댓글 {post.comments.length}</h4>
        <ul className="space-y-1 max-h-40 overflow-y-auto">
          {post.comments.map((c) => (
            <li key={c.id} className={`text-[12px] ${c.status === "hidden" ? "text-slate-400 line-through" : "text-slate-700"}`}>
              <span className="font-semibold">{c.author_name}</span>: {c.body}
            </li>
          ))}
        </ul>
      </section>
      <footer className="flex gap-2 flex-wrap pt-2 border-t border-slate-100">
        {post.status === "visible"
          ? <button type="button" disabled={!allow(role, "cs")} onClick={() => onAction("hide")} className="rounded-lg border border-amber-300 text-amber-700 bg-white px-3 py-1.5 text-xs disabled:opacity-50">숨김</button>
          : <button type="button" disabled={!allow(role, "cs") || post.status === "taken_down"} onClick={() => onAction("unhide")} className="rounded-lg border border-emerald-300 text-emerald-700 bg-white px-3 py-1.5 text-xs disabled:opacity-50">숨김 해제</button>}
        <button type="button" disabled={!allow(role, "secops") || post.status === "taken_down"} onClick={() => onAction("takedown")} className="rounded-lg border border-red-300 text-red-700 bg-white px-3 py-1.5 text-xs disabled:opacity-50">영구 차단</button>
        <button type="button" disabled={!allow(role, "secops")} onClick={() => onAction("hide_all_by_user")} className="rounded-lg border border-red-300 text-red-700 bg-white px-3 py-1.5 text-xs disabled:opacity-50">작성자 일괄 숨김</button>
      </footer>
    </article>
  );
}
