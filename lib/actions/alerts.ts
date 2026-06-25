"use server";

// V2.0 #12 — IncidentAlert server actions.
// Server: GET  /api/v1/admin/alerts?since=&status=
//          POST /api/v1/admin/alerts/:id/ack

import { readSession } from "@/lib/authCookie";
import {
  listIncidentAlerts,
  ackIncidentAlert,
  type IncidentAlertRow,
} from "@/lib/adminApi";

export type ListAlertsResult =
  | { ok: true; items: IncidentAlertRow[] }
  | { ok: false; message: string; code?: string };

export async function listIncidentAlertsAction(args?: {
  since?: string;
  status?: "open" | "closed";
  limit?: number;
}): Promise<ListAlertsResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listIncidentAlerts({ jwt, ...args });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, items: res.data.items };
}

export type AckAlertResult =
  | { ok: true; alert: IncidentAlertRow }
  | { ok: false; message: string; code?: string };

export async function ackIncidentAlertAction(args: {
  id: string;
  note: string;
}): Promise<AckAlertResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.note || args.note.trim().length < 5) {
    return { ok: false, message: "ack note 는 5자 이상." };
  }
  const res = await ackIncidentAlert({ jwt, id: args.id, note: args.note.trim() });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, alert: res.data };
}
