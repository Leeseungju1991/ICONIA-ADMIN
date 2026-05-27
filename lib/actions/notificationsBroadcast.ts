"use server";

// 2026-05-27 — 공지/알람 작성 (앱푸시 + 인앱 배너) server action.
// Server (TBD): POST /api/v1/admin/notifications  body=NotificationCreate
// (참고: 2. SERVER/src/routes/adminNoticesRoutes.js 는 /api/v1/admin/push/campaigns 만 제공 —
//  단순 broadcast 통합 endpoint 는 미구현; 응답이 비어도(또는 404) 깨지지 않게 graceful.)

import { readSession } from "@/lib/authCookie";
import { authedRequest } from "@/lib/httpClient";
import type {
  AdminResult,
  NotificationCreate,
  NotificationCreated,
} from "@/types/admin-api";

function unreachable(code?: string): boolean {
  return code === "ERR_NETWORK" || code === "ERR_SERVER_UNAVAILABLE";
}

export async function broadcastNotificationAction(
  req: NotificationCreate,
): Promise<AdminResult<NotificationCreated>> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!req.title || req.title.trim().length < 2) {
    return { ok: false, message: "제목은 2자 이상." };
  }
  if (!req.body || req.body.trim().length < 5) {
    return { ok: false, message: "본문은 5자 이상." };
  }
  if (!Array.isArray(req.channels) || req.channels.length === 0) {
    return { ok: false, message: "발송 채널을 최소 1개 선택하세요." };
  }
  const res = await authedRequest<NotificationCreated>({
    jwt,
    path: "/api/v1/admin/notifications",
    method: "POST",
    body: {
      title: req.title.trim(),
      body: req.body.trim(),
      channels: req.channels,
      audience_kind: req.audience_kind,
      audience_ids: req.audience_ids,
      ...(req.scheduled_at ? { scheduled_at: req.scheduled_at } : {}),
    },
  });
  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: res.message,
      unreachable: unreachable(res.code),
    };
  }
  return { ok: true, data: res.data };
}
