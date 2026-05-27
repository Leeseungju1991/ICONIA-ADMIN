import Link from "next/link";

type Mode = "critical" | "warn" | "ok";
const BG: Record<Mode, string> = {
  critical: "bg-gradient-to-br from-rose-500 to-red-700",
  warn:     "bg-gradient-to-br from-amber-400 to-orange-600",
  ok:       "bg-gradient-to-br from-indigo-500 to-violet-700",
};

export function HeroBanner({ mode, title, subtitle, cta }: {
  mode: Mode;
  title: string;
  subtitle: string;
  cta?: { label: string; href: string };
}) {
  return (
    <section className={`relative overflow-hidden rounded-3xl text-white p-6 sm:p-8 ${BG[mode]} shadow-lg`}>
      <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10 blur-2xl" aria-hidden />
      <div className="absolute -right-20 -bottom-20 h-60 w-60 rounded-full bg-white/10 blur-3xl" aria-hidden />
      <div className="relative max-w-2xl">
        <div className="text-[10px] uppercase tracking-widest opacity-80">Today</div>
        <h2 className="mt-2 text-2xl sm:text-3xl font-bold leading-tight">{title}</h2>
        <p className="mt-2 text-sm sm:text-base opacity-90 leading-relaxed">{subtitle}</p>
        {cta ? (
          <Link
            href={cta.href}
            className="inline-flex mt-5 items-center gap-2 rounded-full bg-slate-900/80 hover:bg-slate-900 px-5 py-2.5 text-sm font-medium transition"
          >
            {cta.label}
            <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}
