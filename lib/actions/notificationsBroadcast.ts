"use server";

// 2026-05-27 — 공지/알람 작성 (앱푸시 + 인앱 배너) server action.
// Server: POST /api/v1/admin/notifications
//   Server broadcastSchema (adminNoticesRoutes.js) 정본:
//     channel: "push" | "in_app_banner" | "both"  ← 단수 enum
//     segment: "all" | "staff" | "beta"            ← audience optional
//
// DEFECT-1 수정 (2026-06-22) — 이전 코드는 `channels: string[]` / `audience_kind` /
//   `audience_ids` 를 그대로 전송했으나 SERVER zod schema 는 `channel` (단수) 과
//   `segment` 를 기대한다. 불일치로 인해 SERVER 가 422 ERR_VALIDATION 반환.
//   본 수정: NotificationCreate 의 channels[] + audience_kind 를 SERVER schema 로 변환.

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

/**
 * channels[] → SERVER channel enum 변환.
 *   ["push"]                  → "push"
 *   ["in_app_banner"]         → "in_app_banner"
 *   ["push", "in_app_banner"] → "both"
 *   그 외                     → "push" (안전 기본값)
 */
function toServerChannel(channels: string[]): "push" | "in_app_banner" | "both" {
  const hasPush = channels.includes("push");
  const hasBanner = channels.includes("in_app_banner");
  if (hasPush && hasBanner) return "both";
  if (hasBanner) return "in_app_banner";
  return "push";
}

/**
 * audience_kind → SERVER segment enum 변환.
 *   "all"          → "all"
 *   그 외(segment) → "all" fallback (server 는 staff/beta 를 no-op 기록)
 */
function toServerSegment(audienceKind: string): "all" | "staff" | "beta" {
  if (audienceKind === "staff" || audienceKind === "beta") return audienceKind as "staff" | "beta";
  return "all";
}

export async function broadcastNotificationAction(
  req: NotificationCreate,
): Promise<AdminResult<NotificationCreated>> {
  const jwt = await readSession();
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

  // SERVER broadcastSchema 정합 body 변환 (DEFECT-1 수정).
  const serverBody: Record<string, unknown> = {
    title: req.title.trim(),
    body: req.body.trim(),
    channel: toServerChannel(req.channels),   // 단수 enum
    segment: toServerSegment(req.audience_kind), // audience → segment
  };
  if (req.scheduled_at) serverBody.scheduled_at = req.scheduled_at;

  const res = await authedRequest<{ campaign_id: string; queued: boolean; channel: string; delivered_count: number }>({
    jwt,
    path: "/api/v1/admin/notifications",
    method: "POST",
    body: serverBody,
  });
  if (!res.ok) {
    return {
      ok: false,
      code: res.code,
      message: res.message,
      unreachable: unreachable(res.code),
    };
  }
  // SERVER 응답 (202): { campaign_id, queued, channel, banner_id?, delivered_count }
  // NotificationCreated { id, status } 로 정규화.
  return {
    ok: true,
    data: {
      id: res.data.campaign_id,
      status: res.data.queued ? "queued" : "sent",
    },
  };
}
