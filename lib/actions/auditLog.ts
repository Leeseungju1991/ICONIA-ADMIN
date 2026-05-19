"use server";

import { createHash } from "node:crypto";
import { z } from "zod";

import { appendAuditLog, type AuditAppendInput } from "../auditApi";
import { readSession } from "../authCookie";
import type { FormState } from "../types";

// P1 §5 (2026-05-19) — 운영자 액션 감사 로그 server action.
//
// UI 핸들러 (회원 강제 로그아웃, 계정 일시정지, MFA 초기화, 탈퇴, 페르소나 변경)
// 에서 `await recordOperatorAuditAction(...)` 형태로 호출. JWT 는 server cookie 에서
// 직접 읽으므로 client 가 토큰을 다루지 않는다.
//
// payload_hash: 안전한 변경 명세 hash (PII 없이 결정성 입력만). 일반적으로 client
// 가 JSON.stringify 해서 보내고 server 가 hash — 본 액션은 client 가 *원본 객체* 를
// 넘기면 SHA-256 hex 로 환산해 보낸다.

const ALLOWED_ACTIONS = [
  "user.force_logout",
  "user.account_paused",
  "user.account_resumed",
  "user.mfa_reset",
  "user.account_deleted",
  "user.persona_changed",
  "user.pii_unmasked",
] as const;

const schema = z.object({
  action: z.enum(ALLOWED_ACTIONS),
  targetUserId: z.string().min(1).max(128).optional(),
  reasonText: z.string().min(5).max(500).optional(),
});

export type OperatorAuditActionInput = z.infer<typeof schema> & {
  /** 비-PII payload (예: {from, to} 의 페르소나 변경 명세). server-side 에서 SHA-256 으로 환산. */
  payload?: Record<string, unknown>;
};

export async function recordOperatorAuditAction(
  input: OperatorAuditActionInput,
): Promise<FormState> {
  const parsed = schema.safeParse({
    action: input.action,
    targetUserId: input.targetUserId,
    reasonText: input.reasonText,
  });
  if (!parsed.success) {
    return { status: "error", code: "ERR_VALIDATION_LOCAL" };
  }

  const jwt = readSession();
  if (!jwt) {
    return { status: "error", code: "ERR_OPERATOR_AUTH_EXPIRED" };
  }

  let payloadHash: string | undefined;
  if (input.payload && typeof input.payload === "object") {
    try {
      const canonical = JSON.stringify(sortKeysDeep(input.payload));
      payloadHash = createHash("sha256").update(canonical).digest("hex");
    } catch {
      payloadHash = undefined;
    }
  }

  const auditInput: AuditAppendInput = {
    action: parsed.data.action,
    targetUserId: parsed.data.targetUserId,
    targetResourceType: parsed.data.targetUserId ? "user" : undefined,
    targetResourceId: parsed.data.targetUserId,
    reasonText: parsed.data.reasonText,
    payloadHash,
  };

  const result = await appendAuditLog({ jwt, input: auditInput });
  if (result.ok) {
    return { status: "idle", message: "감사 로그를 기록했습니다." };
  }
  return { status: "error", code: result.code, message: result.message };
}

// payload 의 결정성 hash 를 위해 key 정렬 (재귀).
function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeysDeep(obj[k]);
        return acc;
      }, {});
  }
  return value;
}
