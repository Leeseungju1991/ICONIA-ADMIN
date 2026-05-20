"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
};

// 양산화 — 대량 데이터 렌더 보호.
//   실사용 시 수만 행이 들어와도 관리자 패널이 멈추지 않도록, DataTable 이
//   클라이언트 페이지네이션을 내장한다. 한 화면에 그리는 DOM 노드를 `pageSize`
//   행으로 상한선을 두어, rows 길이가 커져도 렌더 비용이 일정하다.
//   - 모든 대시보드 표가 이 단일 컴포넌트를 거치므로, 여기 한 곳이면 전 페이지 보호.
//   - rows 가 pageSize 이하면 페이지네이션 바를 숨겨 기존 UX 와 동일.
//   - 검색/필터로 rows 가 바뀌면 1페이지로 자동 복귀.
const DEFAULT_PAGE_SIZE = 25;

export function DataTable<T extends { id?: string }>({
  columns,
  rows,
  empty = "데이터가 없습니다.",
  rowKey,
  pageSize = DEFAULT_PAGE_SIZE,
}: {
  columns: Column<T>[];
  rows: T[];
  empty?: string;
  rowKey?: (row: T, idx: number) => string;
  /** 페이지당 행 수. 0 이하면 페이지네이션 비활성 (전체 렌더). 기본 25. */
  pageSize?: number;
}) {
  const [page, setPage] = useState(0);

  const paginate = pageSize > 0 && rows.length > pageSize;
  const pageCount = paginate ? Math.ceil(rows.length / pageSize) : 1;

  // rows 가 줄어들어 현재 page 가 범위를 벗어나면 보정 (검색 결과 축소 등).
  useEffect(() => {
    if (page > pageCount - 1) setPage(Math.max(0, pageCount - 1));
  }, [page, pageCount]);

  const visibleRows = useMemo(() => {
    if (!paginate) return rows;
    const start = page * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, paginate, page, pageSize]);

  if (rows.length === 0) {
    return <div className="py-10 text-center text-sm text-muted">{empty}</div>;
  }

  return (
    <div>
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
            {visibleRows.map((row, idx) => (
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

      {paginate ? (
        <Pagination
          page={page}
          pageCount={pageCount}
          pageSize={pageSize}
          total={rows.length}
          onPage={setPage}
        />
      ) : null}
    </div>
  );
}

function Pagination({
  page,
  pageCount,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-muted">
      <span>
        전체 {total.toLocaleString()}건 중 {from.toLocaleString()}–{to.toLocaleString()}
      </span>
      <div className="flex items-center gap-1">
        <button
          className="rounded-lg px-2.5 py-1 bg-white/60 border border-white/60 disabled:opacity-40 hover:bg-white/80 transition"
          type="button"
          onClick={() => onPage(0)}
          disabled={page === 0}
          aria-label="첫 페이지"
        >
          «
        </button>
        <button
          className="rounded-lg px-2.5 py-1 bg-white/60 border border-white/60 disabled:opacity-40 hover:bg-white/80 transition"
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={page === 0}
          aria-label="이전 페이지"
        >
          이전
        </button>
        <span className="px-2 text-slate-700">
          {page + 1} / {pageCount}
        </span>
        <button
          className="rounded-lg px-2.5 py-1 bg-white/60 border border-white/60 disabled:opacity-40 hover:bg-white/80 transition"
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= pageCount - 1}
          aria-label="다음 페이지"
        >
          다음
        </button>
        <button
          className="rounded-lg px-2.5 py-1 bg-white/60 border border-white/60 disabled:opacity-40 hover:bg-white/80 transition"
          type="button"
          onClick={() => onPage(pageCount - 1)}
          disabled={page >= pageCount - 1}
          aria-label="마지막 페이지"
        >
          »
        </button>
      </div>
    </div>
  );
}
