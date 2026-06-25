"use server";

// V2.0 #9 — Trace timeline server action.
// Server: GET /api/v1/admin/trace/:traceId

import { readSession } from "@/lib/authCookie";
import { fetchAdminTrace, type TraceHop } from "@/lib/adminApi";

export type FetchTraceResult =
  | { ok: true; trace_id: string; hops: TraceHop[] }
  | { ok: false; message: string; code?: string };

export async function fetchAdminTraceAction(formData: FormData): Promise<FetchTraceResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const traceId = String(formData.get("trace_id") || "").trim();
  if (!traceId) return { ok: false, message: "trace_id 를 입력하세요." };
  const res = await fetchAdminTrace({ jwt, traceId });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, trace_id: res.data.trace_id, hops: res.data.hops };
}
