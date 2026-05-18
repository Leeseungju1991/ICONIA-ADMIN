type Tone = "up" | "down" | "flat";

export function StatCard({
  label,
  value,
  delta,
  deltaTone = "flat",
  hint,
  accent = "blue",
}: {
  label: string;
  value: string;
  delta?: string;
  deltaTone?: Tone;
  hint?: string;
  accent?: "blue" | "pink" | "purple" | "orange" | "teal";
}) {
  const accentBg: Record<string, string> = {
    blue: "from-accentBlue/40 to-accent/10",
    pink: "from-accentPink/40 to-accent/10",
    purple: "from-accent/40 to-accentBlue/10",
    orange: "from-accentOrange/40 to-accentPink/10",
    teal: "from-accentTeal/40 to-accentBlue/10",
  };
  const toneColor: Record<Tone, string> = {
    up: "text-emerald-600",
    down: "text-rose-600",
    flat: "text-slate-500",
  };

  return (
    <div className={`relative overflow-hidden rounded-3xl glass-panel p-5`}>
      <div className={`pointer-events-none absolute -top-12 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${accentBg[accent]} blur-2xl`} />
      <div className="relative">
        <div className="text-xs text-muted">{label}</div>
        <div className="mt-2 text-2xl font-bold text-slate-900 tracking-tight">{value}</div>
        <div className="mt-1 flex items-center gap-2 text-xs">
          {delta ? <span className={`font-semibold ${toneColor[deltaTone]}`}>{delta}</span> : null}
          {hint ? <span className="text-muted">{hint}</span> : null}
        </div>
      </div>
    </div>
  );
}
