"use server";

import { cookies } from "next/headers";
import { loadEnv } from "../env";

export type OperatorActivityResult =
  | { ok: true; source: "server" | "mock"; weekly: Array<{ date: string; count: number }>; collaborators: Array<{ email: string; actions: number }> }
  | { ok: false; code: string; message: string };

function todayMinus(days: number): string {
  const d = new Date(Date.now() - days * 86_400_000);
  return d.toISOString().slice(0, 10);
}

const MOCK: OperatorActivityResult = {
  ok: true,
  source: "mock",
  weekly: [6, 5, 3, 0, 0, 4, 7].map((c, i) => ({ date: todayMinus(6 - i), count: c })),
  collaborators: [
    { email: "sre1@iconia.example", actions: 14 },
    { email: "cs1@iconia.example", actions: 9 },
    { email: "security1@iconia.example", actions: 6 },
    { email: "super@iconia.example", actions: 3 },
  ],
};

export async function fetchOperatorActivityAction(): Promise<OperatorActivityResult> {
  const token = cookies().get("iconia_admin_jwt")?.value ?? null;
  if (!token) return MOCK;
  const env = loadEnv();
  try {
    const res = await fetch(`${env.ICONIA_SERVER_URL}/api/v1/admin/operators/me/activity`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status >= 500) return MOCK;
    const json = await res.json();
    if (json?.ok === true) {
      return { ok: true, source: "server", weekly: json.data.weekly, collaborators: json.data.collaborators };
    }
    return MOCK;
  } catch {
    return MOCK;
  }
}
