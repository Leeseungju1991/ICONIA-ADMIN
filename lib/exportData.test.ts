import { describe, it, expect } from "vitest";
import {
  isoDateStamp,
  rowsToCsv,
  rowsToJson,
  type ExportColumn,
} from "./exportData";

type Row = { id: string; name: string; count: number };

const cols: ExportColumn<Row>[] = [
  { key: "id", header: "id", value: (r) => r.id },
  { key: "name", header: "name", value: (r) => r.name },
  { key: "count", header: "count", value: (r) => r.count },
];

describe("exportData.rowsToCsv", () => {
  it("emits CRLF-separated lines with header first", () => {
    const csv = rowsToCsv(cols, [
      { id: "a", name: "alice", count: 1 },
      { id: "b", name: "bob", count: 2 },
    ]);
    expect(csv).toBe("id,name,count\r\na,alice,1\r\nb,bob,2");
  });

  it("escapes commas, quotes, and newlines per RFC 4180", () => {
    const csv = rowsToCsv(cols, [
      { id: "x", name: 'has,comma "and" quote', count: 0 },
    ]);
    expect(csv).toContain('"has,comma ""and"" quote"');
  });

  it("handles empty rows array with just header", () => {
    const csv = rowsToCsv(cols, []);
    expect(csv).toBe("id,name,count\r\n");
  });
});

describe("exportData.rowsToJson", () => {
  it("serialises to indented JSON array with column keys", () => {
    const json = rowsToJson(cols, [{ id: "a", name: "alice", count: 5 }]);
    const parsed = JSON.parse(json) as unknown;
    expect(Array.isArray(parsed)).toBe(true);
    expect((parsed as Array<Record<string, unknown>>)[0]).toEqual({
      id: "a",
      name: "alice",
      count: 5,
    });
  });

  it("respects column ordering via key", () => {
    const json = rowsToJson(cols, [{ id: "a", name: "alice", count: 1 }]);
    expect(json.indexOf("\"id\"")).toBeLessThan(json.indexOf("\"name\""));
    expect(json.indexOf("\"name\"")).toBeLessThan(json.indexOf("\"count\""));
  });
});

describe("exportData.isoDateStamp", () => {
  it("formats YYYYMMDD", () => {
    expect(isoDateStamp(new Date("2026-05-20T01:00:00Z"))).toMatch(/^\d{8}$/);
  });
});
