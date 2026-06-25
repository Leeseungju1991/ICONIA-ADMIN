"use server";

// V1.0 #3 — AI 페르소나 admin 상태 server action.
//
// Server: GET /api/v1/admin/personas (Phase1-A, commit 3ddc675).
// PersonaClient.listCatalog + aiHealthTracker SOUL 분해 결합.
// JWT 는 httpOnly cookie 에서만 읽음.

import { readSession } from "@/lib/authCookie";
import { listPersonas, type AdminPersonaRow } from "@/lib/adminApi";

export type ListPersonasResult =
  | {
      ok: true;
      personas: AdminPersonaRow[];
      catalog_error: { code: string; message: string } | null;
    }
  | { ok: false; message: string; code?: string };

export async function listPersonasAction(): Promise<ListPersonasResult> {
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션이 만료되었습니다." };
  const res = await listPersonas({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    personas: res.data.personas,
    catalog_error: res.data.catalog_error,
  };
}
