"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const SERIAL = /^IC-[0-9A-F]{4,}/i;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SearchTarget = "user-360" | "cs";

export function classifyQuery(q: string): SearchTarget {
  const v = q.trim();
  if (EMAIL.test(v)) return "user-360";
  if (SERIAL.test(v)) return "user-360";
  if (UUID.test(v)) return "user-360";
  return "cs";
}

export function TopbarRich({ title, subtitle, operatorEmail, onOpenMenu }: {
  title: string;
  subtitle: string;
  operatorEmail: string | null;
  onOpenMenu?: () => void;
}) {
  const [q, setQ] = useState("");
  const router = useRouter();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!q.trim()) return;
    const target = classifyQuery(q);
    router.push(`/dashboard/${target}?q=${encodeURIComponent(q.trim())}`);
  }

  const initial = (operatorEmail ?? "U").slice(0, 1).toUpperCase();
  return (
    <header className="sticky top-0 z-10 bg-surface border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <button
          className="md:hidden rounded-lg px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700"
          type="button"
          onClick={onOpenMenu}
          aria-label="메뉴 열기"
        >☰</button>
        <div className="min-w-0">
          <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 truncate">{title}</h1>
          <p className="text-xs sm:text-sm text-muted mt-0.5 truncate">{subtitle}</p>
        </div>
      </div>
      <form role="search" onSubmit={onSubmit} className="hidden lg:flex flex-1 max-w-xl mx-4">
        <div className="flex w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 focus-within:border-indigo-400">
          <span aria-hidden>🔍</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="검색 — 이메일 / IC-시리얼 / UUID 는 사용자 360, 그 외는 CS"
            className="flex-1 text-sm bg-transparent outline-none"
          />
        </div>
      </form>
      <div className="flex items-center gap-2 shrink-0">
        <button type="button" aria-label="알림" className="hidden sm:inline-flex h-9 w-9 rounded-full border border-slate-200 bg-white text-slate-600 items-center justify-center">🔔</button>
        <div className="hidden sm:flex items-center gap-2 px-2 py-1.5 rounded-full bg-white border border-slate-200">
          <div className="h-7 w-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold">{initial}</div>
          <div className="text-xs text-slate-700 max-w-[160px] truncate">{operatorEmail ?? "Guest"}</div>
        </div>
      </div>
    </header>
  );
}
