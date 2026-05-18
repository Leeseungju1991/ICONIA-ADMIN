import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
};

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  empty = "데이터가 없습니다.",
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  rowKey?: (row: T, idx: number) => string;
}) {
  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-muted">{empty}</div>;
  }

  return (
    <div className="scroll-x-touch">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="table-head text-left">
            {columns.map((c) => (
              <th
                key={c.key}
                className={[
                  "px-3 py-2 font-medium",
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                  c.className ?? "",
                ].join(" ")}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr
              key={rowKey ? rowKey(row, idx) : row.id ?? String(idx)}
              className="border-b border-white/40 last:border-0 hover:bg-white/40 transition"
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={[
                    "px-3 py-2.5 text-slate-700",
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : "text-left",
                    c.className ?? "",
                  ].join(" ")}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
