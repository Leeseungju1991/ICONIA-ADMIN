"use server";

// Phase 9 #2 — DLQ enumerate + bulk-retry server actions.

import { readSession } from "@/lib/authCookie";
import {
  listDeadLetter,
  retryDeadLetter,
  bulkRetryDeadLetter,
  type DeadLetterRow,
  type BulkRetryResult,
} from "@/lib/adminApi";

export type DlqListResult =
  | { ok: true; items: DeadLetterRow[]; next_cursor: string | null }
  | { ok: false; message: string; code?: string };

export async function listDlqAction(args?: {
  status?: "pending" | "exhausted";
  limit?: number;
}): Promise<DlqListResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listDeadLetter({ jwt, status: args?.status, limit: args?.limit ?? 50 });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, items: res.data.items, next_cursor: res.data.next_cursor };
}

export type DlqRetryResult =
  | { ok: true; exhausted: boolean }
  | { ok: false; message: string; code?: string };

export async function retryDlqAction(args: { id: string }): Promise<DlqRetryResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await retryDeadLetter({ jwt, id: args.id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, exhausted: res.data.exhausted };
}

export type DlqBulkResult =
  | { ok: true; data: BulkRetryResult }
  | { ok: false; message: string; code?: string };

export async function bulkRetryDlqAction(args: { ids: string[] }): Promise<DlqBulkResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!Array.isArray(args.ids) || args.ids.length === 0) {
    return { ok: false, message: "재처리할 ID 가 필요합니다." };
  }
  const res = await bulkRetryDeadLetter({ jwt, ids: args.ids });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
