"use server";

// V3.0 #20 — AS Ticket server actions.
// Server: POST /api/v1/admin/as/tickets · /:id/replace · /:id/close
//          GET  /api/v1/admin/as/tickets?status=

import { readSession } from "@/lib/authCookie";
import {
  createAsTicket,
  replaceAsTicket,
  closeAsTicket,
  listAsTickets,
  type AsTicketRow,
  type AsTicketStatus,
} from "@/lib/adminApi";

export type AsActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; message: string; code?: string };

export async function createAsTicketAction(formData: FormData): Promise<
  AsActionResult<{ ticket: AsTicketRow; unpaired: number }>
> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const user_id = String(formData.get("user_id") || "").trim();
  const device_id = String(formData.get("device_id") || "").trim();
  const reason = String(formData.get("reason") || "").trim();
  if (!user_id || !device_id || reason.length < 5) {
    return { ok: false, message: "user_id / device_id 필수, reason 5자 이상." };
  }
  const res = await createAsTicket({ jwt, user_id, device_id, reason });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export async function replaceAsTicketAction(formData: FormData): Promise<
  AsActionResult<AsTicketRow>
> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const id = String(formData.get("id") || "").trim();
  const replacement_device_id = String(formData.get("replacement_device_id") || "").trim();
  if (!id || !replacement_device_id) {
    return { ok: false, message: "티켓 id 와 교체 기기 id 가 필요합니다." };
  }
  const res = await replaceAsTicket({ jwt, id, replacement_device_id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export async function closeAsTicketAction(formData: FormData): Promise<
  AsActionResult<AsTicketRow>
> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const id = String(formData.get("id") || "").trim();
  const note = String(formData.get("note") || "").trim();
  if (!id || note.length < 5) {
    return { ok: false, message: "티켓 id 와 종료 메모(5자 이상) 가 필요합니다." };
  }
  const res = await closeAsTicket({ jwt, id, note });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export async function listAsTicketsAction(args?: {
  status?: AsTicketStatus;
  limit?: number;
}): Promise<AsActionResult<{ items: AsTicketRow[]; next_cursor: string | null }>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listAsTickets({ jwt, status: args?.status, limit: args?.limit });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}
