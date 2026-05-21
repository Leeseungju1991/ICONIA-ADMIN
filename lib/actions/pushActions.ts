"use server";

// Phase 15-A — Push campaigns server actions (CS_OR_ABOVE).

import { readSession } from "@/lib/authCookie";
import {
  listPushCampaigns,
  createPushCampaign,
  sendPushCampaign,
  type PushCampaignRow,
} from "@/lib/adminApi";

export type CampaignsListResult =
  | { ok: true; items: PushCampaignRow[] }
  | { ok: false; message: string; code?: string };

export async function listCampaignsAction(): Promise<CampaignsListResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await listPushCampaigns({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  const items = (res.data.items as unknown as PushCampaignRow[]) ?? [];
  return { ok: true, items };
}

export type CampaignMutationResult =
  | { ok: true; campaign: PushCampaignRow }
  | { ok: false; message: string; code?: string };

export async function createCampaignAction(args: {
  title: string;
  body: string;
  audience?: string;
}): Promise<CampaignMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!args.title || args.title.trim().length < 2) {
    return { ok: false, message: "제목은 2자 이상." };
  }
  if (!args.body || args.body.trim().length < 5) {
    return { ok: false, message: "본문은 5자 이상." };
  }
  const res = await createPushCampaign({
    jwt,
    title: args.title.trim(),
    body: args.body.trim(),
    audience: args.audience,
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, campaign: res.data };
}

// 클라이언트 측에서 confirm 후 본 action 호출. server action 내부에서는 window 사용 불가.
export async function sendCampaignAction(args: {
  id: string;
}): Promise<CampaignMutationResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await sendPushCampaign({ jwt, id: args.id });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, campaign: res.data };
}
