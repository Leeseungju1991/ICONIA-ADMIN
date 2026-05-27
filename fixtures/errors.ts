// Dev-only fixture — 4도메인 에러 미리보기.

import type { ErrorDomain, ErrorRow } from "@/types/admin-api";

export const fixtureErrorsByDomain: Record<ErrorDomain, ErrorRow[]> = {
  firmware: [
    {
      id: "fw_err_1",
      domain: "firmware",
      fingerprint: "ota.verify.sha256_mismatch",
      message: "OTA image sha256 mismatch (1.4.3 → 1.4.4)",
      stack:
        "esp_https_ota_perform()\n  ota_validator.c:182 verify_sha256\n  ↳ expected=…ABCD got=…1234",
      count_24h: 18,
      affected_users: 14,
      first_seen_at: new Date(Date.now() - 6 * 3600_000).toISOString(),
      last_seen_at: new Date(Date.now() - 11 * 60_000).toISOString(),
      source: "fw v1.4.3",
      severity: "critical",
    },
    {
      id: "fw_err_2",
      domain: "firmware",
      fingerprint: "ble.gap.disconnect.0x3E",
      message: "BLE GAP disconnect 0x3E (LMP connection timeout)",
      stack: null,
      count_24h: 42,
      affected_users: 31,
      first_seen_at: new Date(Date.now() - 23 * 3600_000).toISOString(),
      last_seen_at: new Date(Date.now() - 2 * 60_000).toISOString(),
      source: "fw v1.4.2",
      severity: "medium",
    },
  ],
  server: [
    {
      id: "srv_err_1",
      domain: "server",
      fingerprint: "rest.5xx.gemini_pool_exhausted",
      message: "Gemini key pool exhausted — all keys cooling down",
      stack: "geminiClient.js:204\n  → keyPool.borrow()\n  ↳ ERR_NO_AVAILABLE_KEY",
      count_24h: 7,
      affected_users: 412,
      first_seen_at: new Date(Date.now() - 90 * 60_000).toISOString(),
      last_seen_at: new Date(Date.now() - 9 * 60_000).toISOString(),
      source: "ai-proxy",
      severity: "critical",
    },
  ],
  ai: [
    {
      id: "ai_err_1",
      domain: "ai",
      fingerprint: "ai.fallback.safety_block",
      message: "Gemini safety filter blocked completion (PERSONA_3)",
      stack: null,
      count_24h: 124,
      affected_users: 96,
      first_seen_at: new Date(Date.now() - 5 * 3600_000).toISOString(),
      last_seen_at: new Date(Date.now() - 4 * 60_000).toISOString(),
      source: "gemini-1.5-pro",
      severity: "medium",
    },
  ],
  app: [
    {
      id: "app_err_1",
      domain: "app",
      fingerprint: "rn.unhandled.notification_permission",
      message: "Unhandled rejection in usePushPermission()",
      stack: "App/src/hooks/usePushPermission.ts:42",
      count_24h: 33,
      affected_users: 28,
      first_seen_at: new Date(Date.now() - 10 * 3600_000).toISOString(),
      last_seen_at: new Date(Date.now() - 6 * 60_000).toISOString(),
      source: "App 1.8.0 (iOS)",
      severity: "high",
    },
  ],
};
