"use server";

// Phase 12 #8 — Fleet boot_invariant 위반 디바이스 목록 server action.
// Server: GET /api/v1/admin/devices/boot-invariant-violations (SECOPS_OR_ABOVE)

import { readSession } from "@/lib/authCookie";
import {
  listBootInvariantViolations,
  type BootInvariantViolation,
} from "@/lib/adminApi";

export type ListBootInvariantViolationsResult =
  | {
      ok: true;
      items: BootInvariantViolation[];
      next_cursor: string | null;
      total: number;
      required_mask: number;
    }
  | { ok: false; message: string; code?: string };

export async function listBootInvariantViolationsAction(args?: {
  limit?: number;
}): Promise<ListBootInvariantViolationsResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listBootInvariantViolations({
    jwt,
    limit: args?.limit ?? 50,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    items: res.data.items,
    next_cursor: res.data.next_cursor,
    total: res.data.total,
    required_mask: res.data.required_mask,
  };
}
