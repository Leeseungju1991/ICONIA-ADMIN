import type { ReactNode } from "react";

export function PanelCard({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`relative overflow-hidden rounded-3xl glass-panel p-4 sm:p-6 ${className}`}>
      {(title || actions) && (
        <header className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            {title ? <h2 className="text-base sm:text-lg font-semibold text-slate-900">{title}</h2> : null}
            {description ? <p className="text-xs text-muted mt-0.5">{description}</p> : null}
          </div>
          {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
        </header>
      )}
      {children}
    </section>
  );
}
