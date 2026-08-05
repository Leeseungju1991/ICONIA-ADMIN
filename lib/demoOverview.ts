import type { AdminOverview } from "./adminApi";

// 2026-08 (AWS→Vercel 마이그레이션) — 데모 모드에서 로그인 후 처음 보는
// /dashboard 개요 화면을 실서버 없이도 그럴듯하게 보여주기 위한 샘플 데이터.
export const DEMO_OVERVIEW: AdminOverview = {
  active_devices: 128,
  dau: 342,
  errors_24h: { server: 2, app: 5, firmware: 0 },
  fallback_rate: 0.012,
  queue_depth: 3,
  server_health: "ok",
  firmware_critical_count: 0,
  reports_pending: 4,
  domains: {
    hw: { status: "ok", detail: "128 devices online", observed_at: new Date().toISOString() },
    server: { status: "ok", detail: "p99 182ms (데모)", observed_at: new Date().toISOString() },
    ai: { status: "ok", detail: "fallback 1.2% (데모)", observed_at: new Date().toISOString() },
    app: { status: "ok", detail: "crash-free 99.7% (데모)", observed_at: new Date().toISOString() },
    admin: { status: "ok", detail: "데모 모드로 실행 중", observed_at: new Date().toISOString() },
    aws: { status: "not_applicable", detail: "데모 환경 — AWS 미연동", observed_at: new Date().toISOString() },
  },
  trend_7d: {
    active_devices: [101, 108, 112, 119, 121, 125, 128],
    dau: [280, 295, 300, 318, 325, 336, 342],
    reports_pending: [7, 6, 6, 5, 5, 4, 4],
    queue_depth: [5, 4, 4, 3, 3, 2, 3],
  },
};
