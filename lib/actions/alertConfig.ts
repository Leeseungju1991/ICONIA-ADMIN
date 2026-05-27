"use server";

// V1.0 — 알람 임계치 설정 server action.
//
// Server: GET   /api/v1/admin/alerts/config           — 현재 규칙 + 채널
//          PATCH /api/v1/admin/alerts/config/:key      — 임계치 / 활성 / 채널 변경
//
// 변경은 SRE_OR_ABOVE 만. 사유 5자 이상 강제 (audit_log 영구 기록).

import { readSession } from "@/lib/authCookie";
import {
  getAlertConfig,
  updateAlertRule,
  type AlertConfig,
  type AlertChannelKind,
  type AlertRuleRow,
} from "@/lib/adminApi";

export type AlertConfigResult =
  | { ok: true; data: AlertConfig }
  | { ok: false; message: string; code?: string };

export async function getAlertConfigAction(): Promise<AlertConfigResult> {
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await getAlertConfig({ jwt });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data };
}

export type UpdateAlertRuleInput = {
  key: string;
  threshold?: number;
  enabled?: boolean;
  channels?: AlertChannelKind[];
  note?: string | null;
  reason: string;
};

export type UpdateAlertRuleResult =
  | { ok: true; rule: AlertRuleRow }
  | { ok: false; message: string; code?: string };

export async function updateAlertRuleAction(
  input: UpdateAlertRuleInput,
): Promise<UpdateAlertRuleResult> {
  if (!input.reason || input.reason.trim().length < 5) {
    return { ok: false, message: "사유는 5자 이상." };
  }
  const jwt = readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const { key, reason, ...patch } = input;
  const res = await updateAlertRule({
    jwt,
    key,
    patch,
    reason: reason.trim(),
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, rule: res.data };
}
