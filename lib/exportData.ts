// 클라이언트 측 CSV / JSON 내보내기 유틸 — 외부 라이브러리 없이 Blob + a[download].
//
// 사용처: firmware-errors / server-errors / app-errors / ota 등 운영 표면.
// 서버 export 엔드포인트가 도입되면 본 유틸은 fallback 으로 유지.

export type ExportColumn<T> = {
  key: string;
  header: string;
  /** CSV/JSON 직렬화용 값 추출. */
  value: (row: T) => string | number | boolean | null;
};

function csvEscape(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (s.includes(",") || s.includes("\"") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCsv<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const header = columns.map((c) => csvEscape(c.header)).join(",");
  const body = rows
    .map((row) =>
      columns.map((c) => csvEscape(c.value(row))).join(","),
    )
    .join("\r\n");
  return `${header}\r\n${body}`;
}

export function rowsToJson<T>(columns: ExportColumn<T>[], rows: T[]): string {
  const serialised = rows.map((row) => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) obj[col.key] = col.value(row);
    return obj;
  });
  return JSON.stringify(serialised, null, 2);
}

export function downloadBlob(text: string, filename: string, mime: string): void {
  if (typeof window === "undefined") return;
  // BOM 을 prepend 하면 엑셀에서 한글이 깨지지 않는다.
  const blob = new Blob(
    [mime.startsWith("text/csv") ? "﻿" : "", text],
    { type: `${mime};charset=utf-8` },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // microtask 후 revoke — 안전.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export function exportCsv<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string,
): void {
  const csv = rowsToCsv(columns, rows);
  downloadBlob(csv, filename, "text/csv");
}

export function exportJson<T>(
  columns: ExportColumn<T>[],
  rows: T[],
  filename: string,
): void {
  const json = rowsToJson(columns, rows);
  downloadBlob(json, filename, "application/json");
}

/** YYYY-MM-DD 포맷 파일명 접두. */
export function isoDateStamp(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}
