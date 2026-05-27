"use client";
import type { FeedListItem } from "@/lib/mockFeed";

const TABS: Array<{ key: "latest" | "popular" | "reported"; label: string }> = [
  { key: "latest", label: "최신" },
  { key: "popular", label: "인기" },
  { key: "reported", label: "신고됨" },
];

export function FeedTimeline({ items, tab, onTab, selectedId, onSelect }: {
  items: FeedListItem[];
  tab: "latest" | "popular" | "reported";
  onTab: (t: "latest" | "popular" | "reported") => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => onTab(t.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium ${tab === t.key ? "bg-indigo-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            {t.label}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {items.length === 0 ? <li className="text-xs text-muted py-8 text-center">표시할 게시물이 없습니다</li> : items.map((p) => (
          <li key={p.id}>
            <button type="button" onClick={() => onSelect(p.id)}
              className={`w-full text-left rounded-2xl border bg-white p-3 transition ${selectedId === p.id ? "border-indigo-400 ring-1 ring-indigo-200" : "border-slate-200 hover:border-slate-300"}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-slate-700">{p.author_name}</div>
                <div className="flex gap-1 items-center">
                  {p.report_count > 0 ? <span className="chip chip-error">신고 {p.report_count}</span> : null}
                  <span className={`chip ${p.status === "visible" ? "chip-muted" : p.status === "hidden" ? "chip-warn" : "chip-error"}`}>{p.status}</span>
                </div>
              </div>
              <p className="mt-1 text-sm text-slate-800 line-clamp-2">{p.excerpt}</p>
              <div className="mt-1 text-[11px] text-muted">{new Date(p.created_at).toLocaleString()} · ❤ {p.like_count} · 💬 {p.comment_count}</div>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
