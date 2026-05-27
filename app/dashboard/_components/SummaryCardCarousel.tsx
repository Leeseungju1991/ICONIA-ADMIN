"use client";
import Link from "next/link";
import { useRef } from "react";

export type SummaryCard = {
  id: string;
  title: string;
  count: number;
  hint: string;
  href: string;
};

export function SummaryCardCarousel({ cards, heading = "처리 큐" }: { cards: SummaryCard[]; heading?: string }) {
  const scroller = useRef<HTMLDivElement>(null);
  function scrollBy(n: number) {
    scroller.current?.scrollBy({ left: n, behavior: "smooth" });
  }
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-slate-900">{heading}</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => scrollBy(-320)} type="button" aria-label="이전" className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-500 hover:bg-slate-50">‹</button>
          <button onClick={() => scrollBy(320)} type="button" aria-label="다음" className="w-9 h-9 rounded-full bg-indigo-600 text-white hover:bg-indigo-700">›</button>
        </div>
      </div>
      <div ref={scroller} className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
        {cards.map((c) => (
          <Link key={c.id} href={c.href} className="snap-start min-w-[260px] max-w-[280px] rounded-2xl bg-white border border-slate-200 p-4 hover:shadow-md transition">
            <div className="text-[11px] uppercase tracking-wider text-indigo-600 font-semibold">{c.hint}</div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{c.count.toLocaleString()}</div>
            <div className="mt-1 text-sm font-medium text-slate-700">{c.title}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
