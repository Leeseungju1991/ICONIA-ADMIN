"use server";

// V1.0 — 운영 로그 검색 server action.
//
// Server: GET /api/v1/admin/logs/search  (SRE_OR_ABOVE).
// 검색 조건은 request-id / user-id / endpoint / level / status / 시간 범위.
// PII (이메일/이름/전화) 는 server 가 마스킹.

import { readSession } from "@/lib/authCookie";
import {
  searchLogs,
  type LogEntryRow,
  type LogLevel,
} from "@/lib/adminApi";

export type LogSearchInput = {
  from?: string;
  to?: string;
  level?: LogLevel;
  route?: string;
  request_id?: string;
  user_id?: string;
  status?: string;
  q?: string;
  cursor?: string | null;
  limit?: number;
};

export type LogSearchActionResult =
  | {
      ok: true;
      items: LogEntryRow[];
      next_cursor: string | null;
      approx_total: number;
    }
  | { ok: false; message: string; code?: string };

export async function searchLogsAction(
  input: LogSearchInput,
): Promise<LogSearchActionResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await searchLogs({ jwt, ...input });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    items: res.data.items,
    next_cursor: res.data.next_cursor,
    approx_total: res.data.approx_total,
  };
}
