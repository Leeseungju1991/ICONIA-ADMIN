export function ProfileRail({ operatorEmail, weekly, collaborators }: {
  operatorEmail: string;
  weekly: Array<{ date: string; count: number }>;
  collaborators: Array<{ email: string; actions: number }>;
}) {
  const max = Math.max(1, ...weekly.map((w) => w.count));
  const initial = operatorEmail.slice(0, 1).toUpperCase();
  const total = weekly.reduce((s, w) => s + w.count, 0);
  return (
    <aside className="bg-white border border-slate-200 rounded-3xl p-5 space-y-5">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">Statistic</h3>
        <button type="button" aria-label="더보기" className="text-slate-400">⋯</button>
      </header>
      <div className="flex flex-col items-center text-center">
        <div className="relative h-24 w-24 rounded-full ring-4 ring-indigo-200 bg-indigo-100 text-indigo-700 flex items-center justify-center text-3xl font-bold">
          {initial}
          <span className="absolute -top-1 right-1 text-[10px] bg-indigo-600 text-white px-1.5 py-0.5 rounded-full">{total}</span>
        </div>
        <div className="mt-3 font-semibold text-slate-900 text-sm">안녕하세요</div>
        <div className="text-xs text-muted truncate max-w-[160px]">{operatorEmail}</div>
        <p className="mt-1 text-[11px] text-muted">최근 7일 작업량 추이</p>
      </div>
      <div className="bg-slate-50 rounded-2xl p-3">
        <div className="flex justify-between text-[10px] text-muted mb-2"><span>0</span><span>{max}</span></div>
        <div className="flex items-end justify-between h-20 gap-1">
          {weekly.map((w) => (
            <div key={w.date} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full bg-indigo-300 rounded" style={{ height: `${(w.count / max) * 100}%`, minHeight: 2 }} />
              <div className="text-[9px] text-muted">{w.date.slice(-2)}</div>
            </div>
          ))}
        </div>
      </div>
      <section>
        <h4 className="text-sm font-semibold text-slate-700 mb-2">최근 협업 운영자</h4>
        <ul className="space-y-2">
          {collaborators.map((c) => (
            <li key={c.email} className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs font-semibold">{c.email.slice(0,1).toUpperCase()}</div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-slate-800 truncate">{c.email}</div>
                <div className="text-[10px] text-muted">{c.actions}건 작업</div>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
