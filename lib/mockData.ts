// ICONIA Admin — 데모용 Mock 데이터.
// 실제 백엔드 연동 시 lib/adminApi.ts 의 함수들로 교체.

// 2026-06-12 — 어드민 사용자 목록에 인형 연동 정보 표시 (server adminUserService).
//   handle = 전역 고유 식별자 (인형 넘버 표시용).
export type LinkedDoll = {
  id: string;
  handle: string;
  nickname: string;
  status: string;
  is_primary: boolean;
  // 2026-06-22 — 카탈로그 공식 ID 및 한국어 이름 (서버 adminUserService 추가).
  soul_catalog_id?: string | null;
  soul_name?: string | null;
};

export type UserRow = {
  id: string;
  email: string;
  display_name: string;
  account_status: "active" | "paused" | "deleted" | "pending_deletion";
  totp_enabled: boolean;
  last_login_at: string;
  created_at: string;
  // Server `/api/v1/admin/users` 응답에 미존재 — null 일 때 UI 가 "—" 표시.
  doll_count: number | null;
  // 2026-06-12 — 서버가 doll list 첨부 시 populate. 없으면 null.
  linked_dolls?: LinkedDoll[] | null;
  // 2026-06-12 (사용자 요청 #29) — 마케팅 수신 동의 여부 (true → 동의 / false → 거부 / null → 미응답).
  marketing_opt_in?: boolean | null;
};

export const mockUsers: UserRow[] = [
  { id: "usr_001", email: "alice@example.com", display_name: "Alice K.", account_status: "active", totp_enabled: true, last_login_at: "2026-05-17T22:14:00Z", created_at: "2026-01-12T03:22:00Z", doll_count: 1 },
  { id: "usr_002", email: "bob@example.com", display_name: "Bob Lee", account_status: "active", totp_enabled: false, last_login_at: "2026-05-18T09:01:00Z", created_at: "2026-02-04T11:09:00Z", doll_count: 1 },
  { id: "usr_003", email: "carol@example.com", display_name: "Carol Park", account_status: "paused", totp_enabled: true, last_login_at: "2026-04-30T14:51:00Z", created_at: "2026-01-22T18:40:00Z", doll_count: 0 },
  { id: "usr_004", email: "dave@example.com", display_name: "Dave Choi", account_status: "active", totp_enabled: false, last_login_at: "2026-05-18T07:48:00Z", created_at: "2026-03-15T05:12:00Z", doll_count: 2 },
  { id: "usr_005", email: "eve@example.com", display_name: "Eve Han", account_status: "pending_deletion", totp_enabled: true, last_login_at: "2026-05-10T01:00:00Z", created_at: "2025-12-05T20:55:00Z", doll_count: 1 },
  { id: "usr_006", email: "frank@example.com", display_name: "Frank Min", account_status: "active", totp_enabled: true, last_login_at: "2026-05-18T11:23:00Z", created_at: "2026-04-02T09:31:00Z", doll_count: 1 },
  { id: "usr_007", email: "grace@example.com", display_name: "Grace Yoon", account_status: "deleted", totp_enabled: false, last_login_at: "2026-02-14T08:00:00Z", created_at: "2025-11-19T16:14:00Z", doll_count: 0 },
  { id: "usr_008", email: "henry@example.com", display_name: "Henry Jang", account_status: "active", totp_enabled: false, last_login_at: "2026-05-17T19:45:00Z", created_at: "2026-04-25T12:00:00Z", doll_count: 1 },
];

export type ReportRow = {
  id: string;
  type: "review" | "post" | "comment" | "user";
  target_id: string;
  reporter_id: string;
  reason: string;
  excerpt: string;
  reported_count: number;
  status: "pending" | "resolved" | "rejected" | "hidden";
  created_at: string;
};

export const mockReports: ReportRow[] = [
  { id: "rep_001", type: "review", target_id: "rev_891", reporter_id: "usr_002", reason: "욕설", excerpt: "이거 진짜 ###... 별로다", reported_count: 4, status: "pending", created_at: "2026-05-17T20:10:00Z" },
  { id: "rep_002", type: "post", target_id: "pst_1024", reporter_id: "usr_005", reason: "스팸/홍보", excerpt: "친구 추가하면 무료 코인 드려요 ▶ http://...", reported_count: 12, status: "pending", created_at: "2026-05-17T22:45:00Z" },
  { id: "rep_003", type: "comment", target_id: "cmt_3320", reporter_id: "usr_004", reason: "혐오발언", excerpt: "그런 사람들은 어차피...", reported_count: 7, status: "hidden", created_at: "2026-05-16T08:20:00Z" },
  { id: "rep_004", type: "review", target_id: "rev_900", reporter_id: "usr_001", reason: "허위사실", excerpt: "이 제품 폭발한대요 거짓말", reported_count: 2, status: "rejected", created_at: "2026-05-15T11:00:00Z" },
  { id: "rep_005", type: "user", target_id: "usr_999", reporter_id: "usr_006", reason: "사칭", excerpt: "공식 운영자라고 사칭함", reported_count: 6, status: "pending", created_at: "2026-05-17T16:32:00Z" },
  { id: "rep_006", type: "review", target_id: "rev_902", reporter_id: "usr_008", reason: "음란물", excerpt: "이미지 첨부 부적절", reported_count: 9, status: "hidden", created_at: "2026-05-18T03:11:00Z" },
];

export type NoticeRow = {
  id: string;
  kind: "notice" | "banner";
  title: string;
  body: string;
  audience: "all" | "premium" | "owners";
  active: boolean;
  pinned: boolean;
  starts_at: string;
  ends_at: string | null;
};

export const mockNotices: NoticeRow[] = [
  { id: "ntc_001", kind: "notice", title: "[정기점검] 5/22(목) 02:00~04:00", body: "AWS 서버 정기점검 예정입니다. 채팅·OTA 일시 중단.", audience: "all", active: true, pinned: true, starts_at: "2026-05-15T00:00:00Z", ends_at: "2026-05-22T04:00:00Z" },
  { id: "ntc_002", kind: "banner", title: "신규 페르소나 출시 🎉", body: "5월 신규 캐릭터 4종 공개! 첫 결제 20% 할인", audience: "all", active: true, pinned: false, starts_at: "2026-05-10T00:00:00Z", ends_at: "2026-05-31T00:00:00Z" },
  { id: "ntc_003", kind: "notice", title: "약관 개정 안내 (2026-06-01 시행)", body: "성인 인증 및 데이터 보관 정책이 일부 변경됩니다.", audience: "all", active: true, pinned: true, starts_at: "2026-05-01T00:00:00Z", ends_at: null },
  { id: "ntc_004", kind: "banner", title: "프리미엄 멤버 단독 혜택", body: "월 2,000코인 추가 적립 + 한정 SOUL 액세스", audience: "premium", active: false, pinned: false, starts_at: "2026-04-01T00:00:00Z", ends_at: "2026-04-30T00:00:00Z" },
  { id: "ntc_005", kind: "notice", title: "펌웨어 v1.4.2 배포 안내", body: "터치 응답 개선 및 BLE 안정성 향상.", audience: "owners", active: true, pinned: false, starts_at: "2026-05-12T00:00:00Z", ends_at: null },
];

export type PushRow = {
  id: string;
  title: string;
  body: string;
  audience: "all" | "premium" | "owners" | "inactive_7d";
  scheduled_at: string;
  sent_at: string | null;
  state: "draft" | "scheduled" | "sending" | "sent" | "failed";
  delivered: number;
  opened: number;
  total: number;
};

export const mockPush: PushRow[] = [
  { id: "psh_001", title: "오늘 인형이 당신을 기다려요", body: "마지막 대화 후 3일이 지났어요. 다시 만나볼까요?", audience: "inactive_7d", scheduled_at: "2026-05-18T11:00:00Z", sent_at: "2026-05-18T11:00:12Z", state: "sent", delivered: 1840, opened: 612, total: 1920 },
  { id: "psh_002", title: "신규 캐릭터 출시 🎉", body: "5월의 새 친구를 만나보세요.", audience: "all", scheduled_at: "2026-05-17T20:00:00Z", sent_at: "2026-05-17T20:00:08Z", state: "sent", delivered: 14502, opened: 3110, total: 14820 },
  { id: "psh_003", title: "주말 한정 코인 2배", body: "이번 주말, 충전 시 코인 2배!", audience: "all", scheduled_at: "2026-05-19T10:00:00Z", sent_at: null, state: "scheduled", delivered: 0, opened: 0, total: 0 },
  { id: "psh_004", title: "프리미엄 회원 단독 혜택", body: "한정 SOUL이 추가되었어요.", audience: "premium", scheduled_at: "2026-05-15T18:00:00Z", sent_at: "2026-05-15T18:00:14Z", state: "sent", delivered: 802, opened: 410, total: 820 },
  { id: "psh_005", title: "[테스트] 배송 알림 템플릿", body: "주문이 출고되었어요.", audience: "owners", scheduled_at: "2026-05-12T12:00:00Z", sent_at: null, state: "draft", delivered: 0, opened: 0, total: 0 },
];

export type FirmwareErrorRow = {
  id: string;
  device_id: string;
  firmware_version: string;
  error_code: string;
  message: string;
  count: number;
  first_seen: string;
  last_seen: string;
  severity: "critical" | "error" | "warn";
};

export const mockFirmwareErrors: FirmwareErrorRow[] = [
  { id: "fwerr_001", device_id: "dev_aa11", firmware_version: "1.4.1", error_code: "OTA_DOWNLOAD_FAIL", message: "Wi-Fi disconnect mid-download", count: 47, first_seen: "2026-05-15T01:23:00Z", last_seen: "2026-05-18T09:11:00Z", severity: "error" },
  { id: "fwerr_002", device_id: "dev_bb22", firmware_version: "1.4.2", error_code: "BLE_GATT_TIMEOUT", message: "Provisioning timeout during BLE pairing", count: 23, first_seen: "2026-05-16T10:00:00Z", last_seen: "2026-05-18T07:50:00Z", severity: "warn" },
  { id: "fwerr_003", device_id: "dev_cc33", firmware_version: "1.4.0", error_code: "PANIC_RTC_GPIO", message: "EXT1 wakeup invalid pin mask", count: 8, first_seen: "2026-05-14T18:21:00Z", last_seen: "2026-05-17T22:44:00Z", severity: "critical" },
  { id: "fwerr_004", device_id: "dev_dd44", firmware_version: "1.4.2", error_code: "BATTERY_ADC_OUT_OF_RANGE", message: "ADC read returned -1", count: 152, first_seen: "2026-05-10T05:11:00Z", last_seen: "2026-05-18T11:00:00Z", severity: "warn" },
  { id: "fwerr_005", device_id: "dev_ee55", firmware_version: "1.4.2", error_code: "CAM_INIT_FAIL", message: "Camera sensor failed init after deep sleep", count: 5, first_seen: "2026-05-17T03:42:00Z", last_seen: "2026-05-18T06:00:00Z", severity: "critical" },
];

export type ServerErrorRow = {
  id: string;
  service: "express-api" | "ai-worker" | "persona" | "billing-webhook";
  status_code: number;
  path: string;
  message: string;
  count: number;
  first_seen: string;
  last_seen: string;
};

export const mockServerErrors: ServerErrorRow[] = [
  { id: "srverr_001", service: "express-api", status_code: 500, path: "/api/v1/admin/users/:id", message: "PG connection pool exhausted", count: 12, first_seen: "2026-05-18T03:01:00Z", last_seen: "2026-05-18T03:14:00Z" },
  { id: "srverr_002", service: "ai-worker", status_code: 504, path: "/api/v1/persona/chat", message: "Gemini API gateway timeout (45s)", count: 38, first_seen: "2026-05-17T19:55:00Z", last_seen: "2026-05-18T10:22:00Z" },
  { id: "srverr_003", service: "persona", status_code: 429, path: "/api/v1/persona/chat", message: "Gemini rate limit per minute", count: 410, first_seen: "2026-05-17T20:10:00Z", last_seen: "2026-05-18T11:30:00Z" },
  { id: "srverr_004", service: "billing-webhook", status_code: 502, path: "/webhooks/woo", message: "Bad gateway from origin (Woo)", count: 6, first_seen: "2026-05-16T11:10:00Z", last_seen: "2026-05-18T09:01:00Z" },
  { id: "srverr_005", service: "express-api", status_code: 503, path: "/api/v1/auth/refresh", message: "EFS mount lag during deploy", count: 4, first_seen: "2026-05-18T00:10:00Z", last_seen: "2026-05-18T00:14:00Z" },
];

export type AppErrorRow = {
  id: string;
  platform: "ios" | "android";
  app_version: string;
  os_version: string;
  error_type: string;
  message: string;
  device_model: string;
  count: number;
  affected_users: number;
  first_seen: string;
  last_seen: string;
};

export const mockAppErrors: AppErrorRow[] = [
  { id: "aperr_001", platform: "ios", app_version: "1.8.0", os_version: "iOS 17.4", error_type: "JS_TypeError", message: "Cannot read property 'name' of undefined at ChatScreen.tsx:142", device_model: "iPhone 15 Pro", count: 211, affected_users: 38, first_seen: "2026-05-17T08:22:00Z", last_seen: "2026-05-18T10:50:00Z" },
  { id: "aperr_002", platform: "android", app_version: "1.8.0", os_version: "Android 14", error_type: "Native_BLE", message: "BleManager.connectToDevice: GATT timeout (status 137)", device_model: "Galaxy S24", count: 87, affected_users: 22, first_seen: "2026-05-17T12:00:00Z", last_seen: "2026-05-18T09:11:00Z" },
  { id: "aperr_003", platform: "ios", app_version: "1.7.9", os_version: "iOS 17.3", error_type: "Native_Audio", message: "AVAudioSession activation failed (-50)", device_model: "iPhone 13", count: 41, affected_users: 14, first_seen: "2026-05-15T15:31:00Z", last_seen: "2026-05-18T07:00:00Z" },
  { id: "aperr_004", platform: "android", app_version: "1.8.0", os_version: "Android 13", error_type: "JS_Promise", message: "Unhandled rejection in pushNotification handler", count: 128, affected_users: 50, first_seen: "2026-05-16T20:14:00Z", last_seen: "2026-05-18T11:22:00Z", device_model: "Pixel 7" },
  { id: "aperr_005", platform: "ios", app_version: "1.8.0", os_version: "iOS 17.4", error_type: "Native_Storage", message: "MMKV write failed: no space left", device_model: "iPhone 12", count: 12, affected_users: 8, first_seen: "2026-05-18T01:00:00Z", last_seen: "2026-05-18T10:00:00Z" },
];

export type DashboardMetric = {
  label: string;
  value: string;
  delta: string;
  deltaTone: "up" | "down" | "flat";
  hint: string;
};

export const mockDashboardMetrics: DashboardMetric[] = [
  { label: "활성 회원 (DAU)", value: "12,840", delta: "+4.2%", deltaTone: "up", hint: "전일 대비" },
  { label: "결제 매출 (오늘)", value: "₩ 7,210,000", delta: "+1.8%", deltaTone: "up", hint: "전일 대비" },
  { label: "신고 처리 대기", value: "14", delta: "+3", deltaTone: "down", hint: "신규 신고" },
  { label: "에러 발생 (24h)", value: "1,243", delta: "-12%", deltaTone: "up", hint: "전일 대비" },
];

export const mockStatsTimeseries = [
  { day: "05-12", dau: 11200, signups: 138, revenue: 5200000 },
  { day: "05-13", dau: 11540, signups: 165, revenue: 5810000 },
  { day: "05-14", dau: 12010, signups: 172, revenue: 6240000 },
  { day: "05-15", dau: 12330, signups: 142, revenue: 6020000 },
  { day: "05-16", dau: 12780, signups: 158, revenue: 6520000 },
  { day: "05-17", dau: 12320, signups: 149, revenue: 7080000 },
  { day: "05-18", dau: 12840, signups: 181, revenue: 7210000 },
];

// ── SLO: 사용자 인지된 에러율 시계열 ───────────────────────────────
//
// 정책 (Router → Admin 라운드 2, 2026-05-20):
//   - `total_errors` : 24h 누적 에러 발생 (전 카테고리).
//   - `user_visible` : 그 중 사용자가 명확히 에러로 인지한 건수 (visible 만).
//   - `in_character` : 캐릭터 라인으로 완충된 건수.
//   - `silent`       : 사용자가 인지하지 못한 건수.
//
// SLO 카드는 `user_visible / total_errors` 를 핵심 지표로 사용한다.
// 목표선: ≤ 1.5% (운영자 OKR). 백엔드 미연동 — `/api/v1/admin/error-slo`
// 도입 시 교체.
export type UserPerceivedErrorPoint = {
  day: string;
  total_errors: number;
  user_visible: number;
  in_character: number;
  silent: number;
};

export const mockUserPerceivedErrorRate: UserPerceivedErrorPoint[] = [
  { day: "05-12", total_errors: 1422, user_visible: 28, in_character: 510, silent: 884 },
  { day: "05-13", total_errors: 1380, user_visible: 22, in_character: 488, silent: 870 },
  { day: "05-14", total_errors: 1510, user_visible: 31, in_character: 540, silent: 939 },
  { day: "05-15", total_errors: 1602, user_visible: 38, in_character: 612, silent: 952 },
  { day: "05-16", total_errors: 1430, user_visible: 18, in_character: 502, silent: 910 },
  { day: "05-17", total_errors: 1389, user_visible: 20, in_character: 491, silent: 878 },
  { day: "05-18", total_errors: 1243, user_visible: 14, in_character: 420, silent: 809 },
];

/** SLO 목표 — 사용자 인지된 에러율 (visible / total) 상한선. 1.5% */
export const USER_PERCEIVED_ERROR_SLO_TARGET = 0.015;

// ── OTA 관리 ───────────────────────────────────────────────
export type OtaFirmwareRow = {
  id: string;
  version: string;
  channel: "stable" | "beta" | "canary";
  size_bytes: number;
  uploaded_at: string;
  notes: string;
  state: "draft" | "rolling_out" | "completed" | "rolled_back";
  target_count: number;
  applied_count: number;
  failed_count: number;
};

export const mockOtaFirmwares: OtaFirmwareRow[] = [
  { id: "fw_1_4_2", version: "1.4.2", channel: "stable", size_bytes: 1_842_320, uploaded_at: "2026-05-12T01:00:00Z", notes: "BLE 안정성 + 배터리 ADC 보정", state: "rolling_out", target_count: 12000, applied_count: 8420, failed_count: 32 },
  { id: "fw_1_4_1", version: "1.4.1", channel: "stable", size_bytes: 1_840_010, uploaded_at: "2026-04-22T10:00:00Z", notes: "캠 초기화 retry 로직 추가", state: "completed", target_count: 11800, applied_count: 11770, failed_count: 30 },
  { id: "fw_1_5_0_rc1", version: "1.5.0-rc1", channel: "beta", size_bytes: 1_910_400, uploaded_at: "2026-05-16T07:30:00Z", notes: "신규 페르소나 핸드오프 API + 저전력 모드 v2", state: "rolling_out", target_count: 540, applied_count: 312, failed_count: 4 },
  { id: "fw_1_5_0_dev", version: "1.5.0-dev.b3", channel: "canary", size_bytes: 1_920_180, uploaded_at: "2026-05-18T03:11:00Z", notes: "내부 테스트용. 외부 배포 금지.", state: "draft", target_count: 12, applied_count: 0, failed_count: 0 },
  { id: "fw_1_4_0", version: "1.4.0", channel: "stable", size_bytes: 1_830_000, uploaded_at: "2026-03-30T09:00:00Z", notes: "RTC GPIO panic 회귀 — 1.4.1 로 롤백.", state: "rolled_back", target_count: 9000, applied_count: 1200, failed_count: 240 },
];

// ── AI 페르소나(SOUL) 관리 ──────────────────────────────────
export type PersonaRow = {
  id: string;
  name: string;
  display_label: string;
  language: "ko" | "en";
  voice_id: string;
  state: "live" | "staged" | "draft" | "archived";
  version: string;
  soul_size_bytes: number;
  updated_at: string;
  published_at: string | null;
  active_sessions: number;
  description: string;
};

export const mockPersonas: PersonaRow[] = [
  { id: "psn_lumi", name: "lumi", display_label: "루미", language: "ko", voice_id: "tts_ko_lumi_v2", state: "live", version: "v3.2.1", soul_size_bytes: 184_220, updated_at: "2026-05-14T10:11:00Z", published_at: "2026-05-15T00:00:00Z", active_sessions: 4210, description: "친근한 일상 대화 + 가벼운 위트. 기본 캐릭터." },
  { id: "psn_aria", name: "aria", display_label: "아리아", language: "ko", voice_id: "tts_ko_aria_v1", state: "live", version: "v2.4.0", soul_size_bytes: 162_880, updated_at: "2026-05-08T07:00:00Z", published_at: "2026-05-09T00:00:00Z", active_sessions: 1820, description: "차분하고 사색적인 톤. 야간 대화에 최적화." },
  { id: "psn_taro", name: "taro", display_label: "타로", language: "ko", voice_id: "tts_ko_taro_v1", state: "staged", version: "v1.2.0-rc2", soul_size_bytes: 178_400, updated_at: "2026-05-17T22:50:00Z", published_at: null, active_sessions: 0, description: "유머러스한 남성 페르소나. 5/22 라이브 전환 예정." },
  { id: "psn_kai", name: "kai", display_label: "카이", language: "en", voice_id: "tts_en_kai_v1", state: "draft", version: "v0.9.3", soul_size_bytes: 142_010, updated_at: "2026-05-18T02:30:00Z", published_at: null, active_sessions: 0, description: "영어 페르소나 베타. 글로벌 출시 준비 중." },
  { id: "psn_yuna_old", name: "yuna", display_label: "유나(구)", language: "ko", voice_id: "tts_ko_yuna_v0", state: "archived", version: "v1.8.2", soul_size_bytes: 154_900, updated_at: "2026-02-12T11:00:00Z", published_at: "2026-02-15T00:00:00Z", active_sessions: 0, description: "신규 아리아로 대체. 운영자 페어 복원용으로만 보관." },
];

// ── 디바이스 모니터링 ─────────────────────────────────────
export type DeviceRow = {
  id: string;
  serial: string;
  owner_user_id: string | null;
  firmware_version: string;
  last_seen_at: string;
  online: boolean;
  battery_pct: number;
  // Server `/api/v1/admin/devices` 응답에 미존재 — null 일 때 UI 가 "—" 표시.
  wifi_rssi: number | null;
  region: "KR" | "JP" | "US" | null;
  paired_at: string;
  silenced: boolean | null;
};

export const mockDevices: DeviceRow[] = [
  { id: "dev_aa11", serial: "ICN-25-AA11", owner_user_id: "usr_001", firmware_version: "1.4.2", last_seen_at: "2026-05-18T11:31:00Z", online: true, battery_pct: 84, wifi_rssi: -52, region: "KR", paired_at: "2026-02-01T10:00:00Z", silenced: false },
  { id: "dev_bb22", serial: "ICN-25-BB22", owner_user_id: "usr_002", firmware_version: "1.4.2", last_seen_at: "2026-05-18T10:14:00Z", online: true, battery_pct: 41, wifi_rssi: -68, region: "KR", paired_at: "2026-02-12T09:20:00Z", silenced: false },
  { id: "dev_cc33", serial: "ICN-25-CC33", owner_user_id: "usr_004", firmware_version: "1.4.0", last_seen_at: "2026-05-15T03:50:00Z", online: false, battery_pct: 12, wifi_rssi: -82, region: "KR", paired_at: "2026-03-22T18:00:00Z", silenced: true },
  { id: "dev_dd44", serial: "ICN-25-DD44", owner_user_id: "usr_006", firmware_version: "1.4.2", last_seen_at: "2026-05-18T11:25:00Z", online: true, battery_pct: 67, wifi_rssi: -47, region: "JP", paired_at: "2026-04-04T12:11:00Z", silenced: false },
  { id: "dev_ee55", serial: "ICN-25-EE55", owner_user_id: "usr_008", firmware_version: "1.4.2", last_seen_at: "2026-05-17T22:00:00Z", online: false, battery_pct: 3, wifi_rssi: -90, region: "KR", paired_at: "2026-04-30T09:00:00Z", silenced: false },
  { id: "dev_ff66", serial: "ICN-25-FF66", owner_user_id: null, firmware_version: "1.5.0-rc1", last_seen_at: "2026-05-18T11:00:00Z", online: true, battery_pct: 92, wifi_rssi: -39, region: "KR", paired_at: "2026-05-16T08:00:00Z", silenced: false },
  { id: "dev_gg77", serial: "ICN-25-GG77", owner_user_id: "usr_005", firmware_version: "1.4.1", last_seen_at: "2026-05-10T01:10:00Z", online: false, battery_pct: 0, wifi_rssi: -100, region: "US", paired_at: "2025-12-10T17:00:00Z", silenced: false },
  { id: "dev_hh88", serial: "ICN-25-HH88", owner_user_id: "usr_001", firmware_version: "1.5.0-rc1", last_seen_at: "2026-05-18T11:32:00Z", online: true, battery_pct: 71, wifi_rssi: -55, region: "KR", paired_at: "2026-05-02T10:30:00Z", silenced: false },
];

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString("ko-KR", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}
