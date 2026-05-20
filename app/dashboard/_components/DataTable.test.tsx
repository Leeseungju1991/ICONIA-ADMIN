import { describe, it, expect } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
import { DataTable, type Column } from "./DataTable";

afterEach(cleanup);

type Row = { id: string; name: string };

const columns: Column<Row>[] = [
  { key: "name", header: "이름", render: (r) => r.name },
];

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `row_${i}`,
    name: `행 ${i}`,
  }));
}

describe("DataTable — 대량 데이터 페이지네이션", () => {
  it("renders the empty state when there are no rows", () => {
    render(<DataTable columns={columns} rows={[]} empty="없음" />);
    expect(screen.getByText("없음")).toBeInTheDocument();
  });

  it("shows no pagination bar when rows fit within one page", () => {
    render(<DataTable columns={columns} rows={makeRows(10)} pageSize={25} />);
    expect(screen.queryByText(/전체/)).not.toBeInTheDocument();
    expect(screen.getByText("행 9")).toBeInTheDocument();
  });

  it("caps DOM rows to pageSize even with tens of thousands of rows", () => {
    render(<DataTable columns={columns} rows={makeRows(50_000)} pageSize={25} />);
    // 첫 페이지 25행만 렌더 — 나머지 49,975행은 DOM 에 없음.
    expect(screen.getByText("행 0")).toBeInTheDocument();
    expect(screen.getByText("행 24")).toBeInTheDocument();
    expect(screen.queryByText("행 25")).not.toBeInTheDocument();
    expect(screen.getByText(/전체 50,000건/)).toBeInTheDocument();
  });

  it("advances to the next page", () => {
    render(<DataTable columns={columns} rows={makeRows(60)} pageSize={25} />);
    fireEvent.click(screen.getByRole("button", { name: "다음 페이지" }));
    expect(screen.getByText("행 25")).toBeInTheDocument();
    expect(screen.queryByText("행 0")).not.toBeInTheDocument();
  });

  it("jumps to the last page and disables the next control", () => {
    render(<DataTable columns={columns} rows={makeRows(60)} pageSize={25} />);
    fireEvent.click(screen.getByRole("button", { name: "마지막 페이지" }));
    expect(screen.getByText("행 59")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "다음 페이지" })).toBeDisabled();
  });

  it("renders all rows when pageSize <= 0 (pagination disabled)", () => {
    render(<DataTable columns={columns} rows={makeRows(40)} pageSize={0} />);
    expect(screen.getByText("행 39")).toBeInTheDocument();
    expect(screen.queryByText(/전체/)).not.toBeInTheDocument();
  });
});
