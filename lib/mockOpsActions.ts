// 실패한 운영자 액션 — OTA 배포 실패 / 푸시 발송 실패 / Persona 라이브 전환 실패 등.
// 백엔드 미연동 mock store. 실제 연동 시 Server `/api/v1/admin/ops/actions` 로 교체.

export type OpsActionKind =
  | "ota_rollout"
  | "ota_rollback"
  | "push_send"
  | "persona_go_live"
  | "persona_rollback";

export type OpsActionStatus = "failed" | "queued" | "succeeded";

export type OpsActionRow = {
  id: string;
  kind: OpsActionKind;
  target_label: string;
  target_id: string;
  status: OpsActionStatus;
  /** 마지막 시도 시각. */
  attempted_at: string;
  /** 실패 사유 (status==="failed" 일 때만 의미). */
  failure_reason: string | null;
  /** 실패 원인 코드 — 카탈로그 키. */
  failure_code: string | null;
  /** 재시도 횟수. */
  retry_count: number;
  /** 마지막 운영자 — null 이면 시스템 자동. */
  last_operator_email: string | null;
};

export const OPS_KIND_LABEL: Record<OpsActionKind, string> = {
  ota_rollout: "OTA 배포",
  ota_rollback: "OTA 롤백",
  push_send: "푸시 발송",
  persona_go_live: "Persona 라이브 전환",
  persona_rollback: "Persona 롤백",
};

export const mockOpsActions: OpsActionRow[] = [
  {
    id: "ops_001",
    kind: "ota_rollout",
    target_label: "1.4.2 (stable)",
    target_id: "fw_1_4_2",
    status: "failed",
    attempted_at: "2026-05-18T03:14:00Z",
    failure_reason: "32대 Wi-Fi 끊김 (OTA_DOWNLOAD_FAIL)",
    failure_code: "OTA_DOWNLOAD_FAIL",
    retry_count: 2,
    last_operator_email: "ops@iconia.example.com",
  },
  {
    id: "ops_002",
    kind: "push_send",
    target_label: "[테스트] 배송 알림 템플릿",
    target_id: "psh_005",
    status: "failed",
    attempted_at: "2026-05-12T12:00:00Z",
    failure_reason: "APNs auth 토큰 만료",
    failure_code: "ERR_SERVER_UNAVAILABLE",
    retry_count: 1,
    last_operator_email: "ops@iconia.example.com",
  },
  {
    id: "ops_003",
    kind: "persona_go_live",
    target_label: "타로 v1.2.0-rc2",
    target_id: "psn_taro",
    status: "queued",
    attempted_at: "2026-05-19T22:00:00Z",
    failure_reason: null,
    failure_code: null,
    retry_count: 0,
    last_operator_email: "ops@iconia.example.com",
  },
  {
    id: "ops_004",
    kind: "ota_rollback",
    target_label: "1.4.0 → 1.4.1",
    target_id: "fw_1_4_0",
    status: "succeeded",
    attempted_at: "2026-04-22T10:00:00Z",
    failure_reason: null,
    failure_code: null,
    retry_count: 0,
    last_operator_email: "ops@iconia.example.com",
  },
];
