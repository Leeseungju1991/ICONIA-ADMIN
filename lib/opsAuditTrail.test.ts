/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, it, expect } from "vitest";
import {
  clearOpsAudit,
  listOpsAudit,
  listOpsAuditByAction,
  recordOpsAudit,
  recordOpsAuditWithSilentRetry,
} from "./opsAuditTrail";

afterEach(() => {
  clearOpsAudit();
});

describe("opsAuditTrail", () => {
  it("records and lists entries in reverse chronological order", () => {
    recordOpsAudit({
      action: "ota.rollout_start",
      target_label: "1.5.0 (canary)",
      target_id: "fw_1_5_0",
      reason: "테스트 배포 시작",
      operator: "op@iconia.example.com",
      outcome: "queued",
    });
    recordOpsAudit({
      action: "ota.rollback",
      target_label: "1.5.0 → 1.4.2",
      target_id: "fw_1_5_0",
      reason: "회귀 발견하여 즉시 롤백",
      operator: "op@iconia.example.com",
      outcome: "queued",
    });
    const entries = listOpsAudit();
    expect(entries).toHaveLength(2);
    expect(entries[0].action).toBe("ota.rollback");
    expect(entries[1].action).toBe("ota.rollout_start");
  });

  it("filters by action prefix", () => {
    recordOpsAudit({
      action: "ota.rollback",
      target_label: "x",
      target_id: "x",
      reason: "test 11111",
      operator: "x",
      outcome: "queued",
    });
    recordOpsAudit({
      action: "push.retry",
      target_label: "y",
      target_id: "y",
      reason: "test 22222",
      operator: "x",
      outcome: "queued",
    });
    expect(listOpsAuditByAction("ota.")).toHaveLength(1);
    expect(listOpsAuditByAction("push.")).toHaveLength(1);
    expect(listOpsAuditByAction("persona.")).toHaveLength(0);
  });

  it("assigns unique IDs + ISO timestamps", () => {
    const a = recordOpsAudit({
      action: "x.a",
      target_label: "x",
      target_id: "x",
      reason: "hello",
      operator: "x",
      outcome: "queued",
    });
    const b = recordOpsAudit({
      action: "x.b",
      target_label: "x",
      target_id: "x",
      reason: "hello",
      operator: "x",
      outcome: "queued",
    });
    expect(a.id).not.toBe(b.id);
    expect(() => new Date(a.at).toISOString()).not.toThrow();
  });

  it("recordOpsAuditWithSilentRetry succeeds on first attempt for sessionStorage backend", async () => {
    const r = await recordOpsAuditWithSilentRetry({
      action: "ota.rollout_start",
      target_label: "1.5.0",
      target_id: "fw_1_5_0",
      reason: "silent retry success path",
      operator: "op@iconia.example.com",
      outcome: "queued",
    });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.attempts).toBe(1);
      expect(r.value.action).toBe("ota.rollout_start");
    }
    expect(listOpsAudit()).toHaveLength(1);
  });
});
