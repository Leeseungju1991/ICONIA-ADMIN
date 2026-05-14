import { NextResponse, type NextRequest } from "next/server";
import { readSession } from "@/lib/authCookie";
import { listAuditLog, type AuditEntry } from "@/lib/auditApi";

export const dynamic = "force-dynamic";

// Audit log CSV download — P1 §5.2 #32.
//
// 권한 게이트: middleware 의 /dashboard/:path* match + operatorRoles.PATH_REQUIRED_ROLES
// 의 /dashboard/audit prefix (SECOPS_OR_ABOVE) 가 본 route 에도 적용됨.
//
// 한 번에 최대 MAX_ROWS row. 서버가 cursor 를 돌려주면 그것으로 next page 를 가져와
// MAX_ROWS 한도까지 누적한다. 한도 초과 시 truncated header + 응답 본문 마지막 줄에
// `# TRUNCATED at <ts>` 코멘트 row 를 추가해 운영자가 명시적으로 인지하도록 한다.

const MAX_ROWS = 10_000;
const PAGE_LIMIT = 500; // Server 권장 max (대량 export 는 별도 streaming endpoint).

const CSV_HEADERS = [
  "sequence_no",
  "id",
  "action",
  "action_outcome",
  "operator_id",
  "operator_role",
  "user_id",
  "target_resource_type",
  "target_resource_id",
  "ip",
  "user_agent",
  "request_id",
  "created_at",
  "prev_hash",
  "current_hash",
] as const;

function escapeCsvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  // Excel/RFC 4180: 쌍따옴표/콤마/개행이 있으면 전체를 따옴표 wrap + 내부 " → ""
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function rowToCsv(row: AuditEntry): string {
  return [
    row.sequence_no ?? "",
    row.id,
    row.action,
    row.action_outcome ?? "",
    row.operator_id ?? "",
    row.operator_role ?? "",
    row.user_id ?? "",
    row.target_resource_type ?? "",
    row.target_resource_id ?? "",
    row.ip,
    row.user_agent,
    row.request_id ?? "",
    row.created_at,
    row.prev_hash ?? "",
    row.current_hash ?? "",
  ]
    .map(escapeCsvField)
    .join(",");
}

function normalizeIso(value: string | null): string | undefined {
  if (!value) return undefined;
  // datetime-local 은 timezone 없음 — UTC 가정으로 ISO 화.
  // 이미 'Z' 또는 offset 이 있으면 그대로 사용.
  if (/[Zz]|[+-]\d{2}:\d{2}$/.test(value)) return value;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

function isoNowStamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

export async function GET(req: NextRequest) {
  const jwt = readSession();
  if (!jwt) {
    return NextResponse.json(
      { ok: false, error: { code: "ERR_NO_SESSION", message: "no_session" } },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(req.url);
  const since = normalizeIso(searchParams.get("since"));
  const until = normalizeIso(searchParams.get("until"));
  const action = searchParams.get("action") || undefined;

  if (!since) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "ERR_VALIDATION", message: "since is required" },
      },
      { status: 400 },
    );
  }

  // 누적 페이지 fetch — Server 가 cursor 를 돌려줄 때까지 / MAX_ROWS 까지.
  const rows: AuditEntry[] = [];
  let cursor: string | null = null;
  let truncated = false;
  let firstSinceEcho: string | null = null;

  for (;;) {
    const remaining = MAX_ROWS - rows.length;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const res = await listAuditLog({
      jwt,
      since,
      action,
      cursor,
      limit: Math.min(PAGE_LIMIT, remaining),
    });
    if (!res.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: { code: res.code, message: res.message },
        },
        { status: res.status || 500 },
      );
    }
    if (firstSinceEcho === null) firstSinceEcho = res.data.since;
    for (const row of res.data.items) {
      // until 가 주어졌으면 client side filter — Server endpoint 는 until 미지원
      // 일 수 있으나 본 export 에서 명시적 cutoff 보장.
      if (until && row.created_at > until) continue;
      rows.push(row);
      if (rows.length >= MAX_ROWS) {
        truncated = true;
        break;
      }
    }
    if (truncated) break;
    if (!res.data.next_cursor || res.data.items.length === 0) break;
    cursor = res.data.next_cursor;
  }

  const lines: string[] = [CSV_HEADERS.join(",")];
  for (const row of rows) lines.push(rowToCsv(row));
  if (truncated) {
    lines.push(
      `# TRUNCATED at ${new Date().toISOString()} — exceeded MAX_ROWS=${MAX_ROWS}. Narrow the time window or use streaming export.`,
    );
  }
  const body = lines.join("\r\n") + "\r\n";

  const filename = `audit-log-${isoNowStamp()}.csv`;
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Row-Count": String(rows.length),
      "X-Truncated": truncated ? "1" : "0",
      "Cache-Control": "no-store",
    },
  });
}
