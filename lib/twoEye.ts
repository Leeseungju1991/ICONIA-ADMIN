// ICONIA-Admin 2인 승인(2-eye) 헬퍼.
//
// 중요 mutation 액션(예: 운영자 비활성화, 페르소나 라이브 전환, OTA abort)에
// 다른 운영자 1명의 승인을 요구. 현재는 client-side 세션 기반 요청 토큰 발급 +
// audit_log 로 기록. Server 정본 2-eye 워크플로(인증된 두 운영자 JWT 동시 검증)는
// 후속 라운드. 본 헬퍼는 UI 게이트 + audit 의 단일 진입점.
//
// 사용:
//   const ticket = await requestTwoEyeApproval({ action: "operator.disable", target: "op_123" });
//   if (ticket.status === "approved") { ... }

import type { OperatorRole } from "./operatorRoles";

export type TwoEyeAction =
  | "operator.disable"
  | "persona.promote_live"
  | "ota.abort"
  | "kill_switch.enable_global"
  | "pipa.finalize_deletion";

export type TwoEyeTicket = {
  id: string;
  action: TwoEyeAction;
  target: string;
  requestedBy: string;
  requestedAt: string;
  status: "pending" | "approved" | "rejected" | "expired";
  approvedBy?: string;
  approvedAt?: string;
};

const TWO_EYE_TTL_MS = 5 * 60 * 1000; // 5분
const SESSION_STORE_KEY = "iconia_two_eye_tickets_v1";

function loadSession(): TwoEyeTicket[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORE_KEY);
    return raw ? (JSON.parse(raw) as TwoEyeTicket[]) : [];
  } catch {
    return [];
  }
}

function saveSession(tickets: TwoEyeTicket[]) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_STORE_KEY, JSON.stringify(tickets));
  } catch {
    // QuotaExceeded / private mode — silent.
  }
}

function newId(): string {
  return `te_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 2인 승인 티켓 생성. UI 가 즉시 호출하고, 다른 운영자가 본 세션에서
 * `approveTwoEyeTicket(id)` 호출. 현재 구현은 client-only 세션 — Server 정본
 * 도입 후 server action 으로 교체될 인터페이스.
 */
export function requestTwoEyeApproval(args: {
  action: TwoEyeAction;
  target: string;
  operatorEmail: string;
}): TwoEyeTicket {
  const ticket: TwoEyeTicket = {
    id: newId(),
    action: args.action,
    target: args.target,
    requestedBy: args.operatorEmail,
    requestedAt: new Date().toISOString(),
    status: "pending",
  };
  const all = loadSession();
  all.push(ticket);
  saveSession(all);
  return ticket;
}

export function approveTwoEyeTicket(args: {
  ticketId: string;
  approverEmail: string;
  approverRole: OperatorRole;
}): TwoEyeTicket | null {
  // 본인 승인 차단은 호출자에서 ticket.requestedBy !== approverEmail 검증.
  // superadmin 만 승인 가능 (운영 정책).
  if (args.approverRole !== "superadmin") return null;
  const all = loadSession();
  const idx = all.findIndex((t) => t.id === args.ticketId);
  if (idx < 0) return null;
  const ticket = all[idx];
  if (ticket.status !== "pending") return null;
  if (ticket.requestedBy === args.approverEmail) return null; // self-approval 차단
  const ageMs = Date.now() - new Date(ticket.requestedAt).getTime();
  if (ageMs > TWO_EYE_TTL_MS) {
    all[idx] = { ...ticket, status: "expired" };
    saveSession(all);
    return all[idx];
  }
  all[idx] = {
    ...ticket,
    status: "approved",
    approvedBy: args.approverEmail,
    approvedAt: new Date().toISOString(),
  };
  saveSession(all);
  return all[idx];
}

export function listPendingTwoEyeTickets(): TwoEyeTicket[] {
  return loadSession().filter((t) => t.status === "pending");
}

export function getTwoEyeTicket(id: string): TwoEyeTicket | null {
  return loadSession().find((t) => t.id === id) ?? null;
}

/**
 * UI 가드 — 승인된 티켓이 있을 때만 액션 실행. 없으면 null 반환 → UI 가 모달 띄움.
 */
export function requireApprovedTicket(ticketId: string): TwoEyeTicket | null {
  const ticket = getTwoEyeTicket(ticketId);
  if (!ticket || ticket.status !== "approved") return null;
  return ticket;
}
