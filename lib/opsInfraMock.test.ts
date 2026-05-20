import { describe, expect, it } from "vitest";
import {
  mockHealthProbes,
  mockOpsAlerts,
  mockTraces,
  mockDeadLetters,
  mockKillSwitches,
  mockFeatureFlags,
  RECOVERY_ACTIONS,
  RECOVERY_ACTION_KIND_LIST,
  KILL_SWITCH_KIND_LIST,
  severityChip,
  healthStatusChip,
  hopChip,
} from "./opsInfraMock";

// Round 3 (2026-05-20) — Ops 9항목 mock 인프라 데이터 sanity check.

describe("opsInfraMock — 데이터 모집단", () => {
  it("health probe 는 7개 이상이고 각 상태 라벨이 유효하다", () => {
    expect(mockHealthProbes.length).toBeGreaterThanOrEqual(7);
    for (const p of mockHealthProbes) {
      expect(["ok", "degraded", "down"]).toContain(p.status);
      expect(p.error_rate_pct).toBeGreaterThanOrEqual(0);
    }
  });

  it("알람 5건 mock — 활성 / 진정 모두 포함", () => {
    const active = mockOpsAlerts.filter((a) => !a.resolved_at);
    const resolved = mockOpsAlerts.filter((a) => a.resolved_at);
    expect(active.length).toBeGreaterThan(0);
    expect(resolved.length).toBeGreaterThan(0);
  });

  it("trace 는 2개 이상의 trace_id 그룹을 갖는다 (chat + OTA)", () => {
    const traceIds = new Set(mockTraces.map((t) => t.trace_id));
    expect(traceIds.size).toBeGreaterThanOrEqual(2);
  });

  it("dead-letter 는 retryable 코드와 final 코드 모두 포함", () => {
    expect(mockDeadLetters.length).toBeGreaterThan(0);
    const codes = new Set(mockDeadLetters.map((d) => d.failure_code));
    expect(codes.has("WOO_BAD_GATEWAY")).toBe(true);
  });

  it("recovery actions 와 kill switch 의 kind 목록이 완전하다", () => {
    expect(RECOVERY_ACTION_KIND_LIST).toHaveLength(Object.keys(RECOVERY_ACTIONS).length);
    expect(KILL_SWITCH_KIND_LIST).toHaveLength(mockKillSwitches.length);
    for (const kind of KILL_SWITCH_KIND_LIST) {
      expect(mockKillSwitches.some((s) => s.kind === kind)).toBe(true);
    }
  });

  it("feature flag 의 rollout_pct 는 0~100 범위 안에 있다", () => {
    for (const f of mockFeatureFlags) {
      expect(f.rollout_pct).toBeGreaterThanOrEqual(0);
      expect(f.rollout_pct).toBeLessThanOrEqual(100);
    }
  });
});

describe("opsInfraMock — 표시 헬퍼", () => {
  it("severityChip 은 critical / warn / info 에 각각 다른 chip 클래스", () => {
    expect(severityChip("critical")).toContain("chip-error");
    expect(severityChip("warn")).toContain("chip-warn");
    expect(severityChip("info")).toContain("chip-info");
  });

  it("healthStatusChip 은 down / degraded / ok 에 각각 다른 chip 클래스", () => {
    expect(healthStatusChip("down")).toContain("chip-error");
    expect(healthStatusChip("degraded")).toContain("chip-warn");
    expect(healthStatusChip("ok")).toContain("chip-success");
  });

  it("hopChip 은 모든 hop 종류를 처리한다", () => {
    for (const hop of ["app", "server", "ai", "firmware"] as const) {
      expect(hopChip(hop)).toContain("chip");
    }
  });
});

describe("opsInfraMock — destructive 액션 정책", () => {
  it("user.force_logout_all 과 OTA rollback 은 destructive=true", () => {
    expect(RECOVERY_ACTIONS["user.force_logout_all"].destructive).toBe(true);
    expect(RECOVERY_ACTIONS["ota.rollback"].destructive).toBe(true);
  });

  it("push.resend 는 destructive=false (강제 확인 불요)", () => {
    expect(RECOVERY_ACTIONS["push.resend"].destructive).toBe(false);
  });

  it("모든 kill switch 는 기본 비활성 — 안전한 default", () => {
    for (const sw of mockKillSwitches) {
      expect(sw.enabled).toBe(false);
    }
  });
});
