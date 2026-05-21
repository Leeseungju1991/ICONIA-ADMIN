"use server";

// Phase 15-B — Server stub endpoint 4종 server action.
// Server: GET /api/v1/admin/{notices, push/campaigns, errors/server, errors/app}

import { readSession } from "@/lib/authCookie";
import {
  listNotices,
  listPushCampaigns,
  listServerErrors,
  listAppErrors,
  type StubListResponse,
} from "@/lib/adminApi";

export type StubListResult =
  | { ok: true; items: Record<string, unknown>[]; total: number; source: string }
  | { ok: false; message: string; code?: string };

async function callStub(
  fn: (args: { jwt: string }) => Promise<{ ok: boolean } & Record<string, unknown>>,
): Promise<StubListResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = (await fn({ jwt })) as
    | { ok: true; data: StubListResponse }
    | { ok: false; message: string; code?: string };
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return {
    ok: true,
    items: res.data.items,
    total: res.data.total,
    source: res.data.source,
  };
}

export async function listNoticesAction(): Promise<StubListResult> {
  return callStub(listNotices);
}
export async function listPushCampaignsAction(): Promise<StubListResult> {
  return callStub(listPushCampaigns);
}
export async function listServerErrorsAction(): Promise<StubListResult> {
  return callStub(listServerErrors);
}
export async function listAppErrorsAction(): Promise<StubListResult> {
  return callStub(listAppErrors);
}
