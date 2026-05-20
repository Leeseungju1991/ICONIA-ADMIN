// 운영자 로컬 audit trail — retry / rollback / 수동 조치 시도를 sessionStorage 에 기록.
//
// 본 모듈은 *백엔드 audit 가 도입되기 전 임시 표면*. 서버 측 audit_logs 가 권한 있는
// canonical 기록이며, 본 trail 은 동일 세션 내 운영자가 *방금* 수행한 시도를 화면에 보이게
// 해 주는 보조 UI 표면이다.
//
// 실제 백엔드 연동 시:
//   - record() → `appendAuditLog(...)` (lib/auditApi.ts) 호출로 교체.
//   - list() → `listAuditLog(...)` 결과로 교체.
//
// 본 라운드 (2026-05-20) 추가:
//   - `recordOpsAuditWithSilentRetry()` — 운영자 액션의 *일시 실패*를 silent 하게 재시도.
//     백엔드 연동 후 fetch 실패가 transient(5xx/timeout) 면 사용자에게 노출하지 않고
//     자동 재시도. 최종 실패만 호출자에게 ok:false 로 반환.

import { runWithSilentRetry, defaultIsTransient, type SilentRetryResult } from "./silentRetry";

export type OpsAuditEntry = {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** "ota.retry", "push.retry", "persona.rollback" 등 도트 표기. */
  action: string;
  target_label: string;
  target_id: string;
  /** 5자 이상의 운영자 입력 사유. */
  reason: string;
  /** 운영자 식별자 (이메일) — 미식별 시 "(unknown)". */
  operator: string;
  /** 결과 — UI 흐름상 항상 "queued"; 백엔드 연결 후 actual outcome. */
  outcome: "queued" | "succeeded" | "failed";
};

const KEY = "iconia.admin.opsAuditTrail";
const MAX = 200;

function safeRead(): OpsAuditEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((e): e is OpsAuditEntry => {
      return (
        e &&
        typeof e === "object" &&
        typeof e.id === "string" &&
        typeof e.action === "string"
      );
    });
  } catch {
    return [];
  }
}

function safeWrite(entries: OpsAuditEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* quota — ignore */
  }
}

export function listOpsAudit(): OpsAuditEntry[] {
  return safeRead();
}

export function listOpsAuditByAction(prefix: string): OpsAuditEntry[] {
  return safeRead().filter((e) => e.action.startsWith(prefix));
}

export function recordOpsAudit(input: Omit<OpsAuditEntry, "id" | "at">): OpsAuditEntry {
  const entry: OpsAuditEntry = {
    id: `oa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    at: new Date().toISOString(),
    ...input,
  };
  const next = [entry, ...safeRead()];
  safeWrite(next);
  return entry;
}

export function clearOpsAudit(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/**
 * 운영자 액션 audit 기록을 *silent retry* 로 감싸 호출.
 *
 * 현재 단계 (mock) — `recordOpsAudit` 자체는 sessionStorage 동기 호출이라 거의
 * 실패하지 않으므로, 본 함수는 백엔드 연동 후 `appendAuditLog(...)` 호출로 교체될
 * 자리에 *형태만 유지* 한다. 즉 호출자(페이지 핸들러)는 백엔드 도입 후에도 핸들러
 * 코드를 바꾸지 않아도 되도록 본 함수를 호출해 둔다.
 *
 * 정책:
 *   - 일시 실패(transient — 5xx/timeout)는 silent 재시도, 운영자에게 노출 안 함.
 *   - 최종 실패는 ok:false 로 호출자에게 반환 → 호출자가 명확한 toast.
 */
export async function recordOpsAuditWithSilentRetry(
  input: Omit<OpsAuditEntry, "id" | "at">,
  options?: { maxAttempts?: number; baseDelayMs?: number },
): Promise<SilentRetryResult<OpsAuditEntry>> {
  return runWithSilentRetry(() => recordOpsAudit(input), {
    maxAttempts: options?.maxAttempts ?? 3,
    baseDelayMs: options?.baseDelayMs ?? 250,
    isTransient: defaultIsTransient,
  });
}
