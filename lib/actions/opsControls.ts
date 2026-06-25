"use server";

// V1.0 — 수동 운영 작업 server actions.
//
//   - DLQ 재처리: 별도 lib/actions/dlq.ts 에 이미 존재.
//   - circuit breaker 강제 close: POST /api/v1/admin/ops/circuit/:name/close
//   - 캐시 invalidate            : POST /api/v1/admin/ops/cache/invalidate
//   - 메인터넌스 모드 토글       : POST /api/v1/admin/ops/maintenance
//
// 모두 SRE_OR_ABOVE + 사유 5자 이상 + Server audit_log.

import { readSession } from "@/lib/authCookie";
import {
  closeCircuitBreaker,
  invalidateCache,
  setMaintenanceMode,
} from "@/lib/adminApi";

function requireReason(reason: string | undefined): string | null {
  if (!reason || reason.trim().length < 5) return null;
  return reason.trim();
}

export type OpsControlResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; message: string; code?: string };

export async function closeCircuitAction(input: {
  name: string;
  reason: string;
}): Promise<OpsControlResult> {
  const reason = requireReason(input.reason);
  if (!reason) return { ok: false, message: "사유는 5자 이상." };
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!input.name) return { ok: false, message: "circuit breaker 이름이 필요합니다." };
  const res = await closeCircuitBreaker({ jwt, name: input.name, reason });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data as unknown as Record<string, unknown> };
}

export async function invalidateCacheAction(input: {
  selector: string;
  reason: string;
}): Promise<OpsControlResult> {
  const reason = requireReason(input.reason);
  if (!reason) return { ok: false, message: "사유는 5자 이상." };
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  if (!input.selector) return { ok: false, message: "selector 가 필요합니다." };
  const res = await invalidateCache({ jwt, selector: input.selector, reason });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data as unknown as Record<string, unknown> };
}

export async function setMaintenanceAction(input: {
  enabled: boolean;
  reason: string;
  until?: string;
}): Promise<OpsControlResult> {
  const reason = requireReason(input.reason);
  if (!reason) return { ok: false, message: "사유는 5자 이상." };
  const jwt = await readSession();
  if (!jwt) return { ok: false, message: "세션 만료" };
  const res = await setMaintenanceMode({
    jwt,
    enabled: input.enabled,
    reason,
    ...(input.until ? { until: input.until } : {}),
  });
  if (!res.ok) return { ok: false, message: res.message, code: res.code };
  return { ok: true, data: res.data as unknown as Record<string, unknown> };
}
