import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  requestTwoEyeApproval,
  approveTwoEyeTicket,
  listPendingTwoEyeTickets,
  requireApprovedTicket,
} from "./twoEye";

// sessionStorage mock (vitest 의 jsdom 환경이면 기본 있음).
beforeEach(() => {
  if (typeof window !== "undefined") {
    window.sessionStorage.clear();
  }
});

describe("twoEye", () => {
  it("requests an approval ticket", () => {
    const ticket = requestTwoEyeApproval({
      action: "operator.disable",
      target: "op_123",
      operatorEmail: "requester@example.com",
    });
    expect(ticket.status).toBe("pending");
    expect(ticket.action).toBe("operator.disable");
    expect(ticket.requestedBy).toBe("requester@example.com");
    expect(listPendingTwoEyeTickets().length).toBe(1);
  });

  it("rejects self-approval", () => {
    const ticket = requestTwoEyeApproval({
      action: "operator.disable",
      target: "op_123",
      operatorEmail: "alice@example.com",
    });
    const r = approveTwoEyeTicket({
      ticketId: ticket.id,
      approverEmail: "alice@example.com",
      approverRole: "superadmin",
    });
    expect(r).toBeNull();
  });

  it("rejects non-superadmin approval", () => {
    const ticket = requestTwoEyeApproval({
      action: "operator.disable",
      target: "op_123",
      operatorEmail: "alice@example.com",
    });
    const r = approveTwoEyeTicket({
      ticketId: ticket.id,
      approverEmail: "bob@example.com",
      approverRole: "sre",
    });
    expect(r).toBeNull();
  });

  it("approves with different superadmin", () => {
    const ticket = requestTwoEyeApproval({
      action: "operator.disable",
      target: "op_123",
      operatorEmail: "alice@example.com",
    });
    const r = approveTwoEyeTicket({
      ticketId: ticket.id,
      approverEmail: "bob@example.com",
      approverRole: "superadmin",
    });
    expect(r?.status).toBe("approved");
    expect(r?.approvedBy).toBe("bob@example.com");
    expect(requireApprovedTicket(ticket.id)?.status).toBe("approved");
  });

  it("expires tickets after TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-26T10:00:00Z"));
    const ticket = requestTwoEyeApproval({
      action: "operator.disable",
      target: "op_123",
      operatorEmail: "alice@example.com",
    });
    vi.setSystemTime(new Date("2026-05-26T10:06:00Z")); // 6분 후
    const r = approveTwoEyeTicket({
      ticketId: ticket.id,
      approverEmail: "bob@example.com",
      approverRole: "superadmin",
    });
    expect(r?.status).toBe("expired");
    vi.useRealTimers();
  });
});
