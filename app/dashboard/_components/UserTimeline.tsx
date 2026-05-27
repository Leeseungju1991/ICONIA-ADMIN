import type { User360Event } from "@/lib/mockUser360";

const KIND_CHIP: Record<User360Event["kind"], string> = {
  login: "chip-muted", logout: "chip-muted", pairing: "chip-info",
  ota: "chip-warn", report: "chip-error", ai_fallback: "chip-info", admin_action: "chip-error",
};

export function UserTimeline({ events }: { events: User360Event[] }) {
  if (!events.length) return <div className="text-xs text-muted py-8 text-center">이벤트 없음</div>;
  return (
    <ol className="relative ml-3 border-l border-slate-200 pl-5 space-y-3">
      {events.map((e) => (
        <li key={e.id} className="relative">
          <span className="absolute -left-[1.55rem] top-1 h-3 w-3 rounded-full bg-white border border-slate-300" aria-hidden />
          <div className="flex items-center gap-2">
            <span className={`chip ${KIND_CHIP[e.kind]}`}>{e.kind}</span>
            <span className="text-sm font-medium text-slate-800">{e.title}</span>
          </div>
          <div className="mt-0.5 text-[11px] text-muted">{new Date(e.at).toLocaleString()} {e.meta ? `· ${e.meta}` : ""}</div>
        </li>
      ))}
    </ol>
  );
}
