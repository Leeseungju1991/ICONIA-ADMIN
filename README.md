# ICONIA-ADMIN

**단일 운영자(Owner) 전용** 운영 콘솔. ICONIA-Server 의 `/api/v1/operator/*` ·
`/api/v1/admin/*` 라우트를 인간 친화적 UI 로 노출하고, 출시 준비에 필요한
실시간 로그·crash analytics·monitoring·push delivery 가시화 표면을 단일 콘솔에서
제공한다.

- Repo: <https://github.com/Leeseungju1991/ICONIA-ADMIN>
- 패키지명 (`package.json`): `iconia-admin-web`
- 스택: Next.js 14 (App Router) · React 18 · Tailwind 3 · Zod · Vitest

> RBAC (cs/sre/secops/superadmin) 은 본 라운드에서 사용하지 않음. `lib/operatorRoles.ts`
> 의 enum / 매트릭스는 multi-operator 도입 시점을 위한 defense-in-depth 골격만 보존.
> 실제 권한 결정은 항상 ICONIA-Server 가 매 요청 JWT 검증.

---

## 1. 동작 순서도

```
┌──────────────────────────────────────────────────────────────────────┐
│  1) 운영자 로그인                                                       │
│     /login (email + password)                                          │
│        ├─ MFA 필요 → /login/mfa?token=...  (TOTP 또는 복구 코드)          │
│        └─ MFA 불필요 → JWT 발급 (httpOnly + SameSite=Strict)             │
│                                                                       │
│  2) middleware.ts gating                                              │
│     /dashboard* 접근 시 쿠키 부재 → /login redirect                       │
│     idle 임계 초과 시 자동 로그아웃 (기본 30 분, ADMIN_IDLE_TIMEOUT_MINUTES) │
│                                                                       │
│  3) 대시보드 진입                                                       │
│     /dashboard  ─ env 배지(PROD/STAGING/DEV) · 운영자 chip                │
│        ├─ 활성 회원 · 매출 · 신고 대기 · 에러 (24h) StatCard 4종           │
│        ├─ 처리 대기 신고 패널 + 펌웨어 critical + 서버 5xx 최신             │
│        └─ 앱 에러 최신 카드                                               │
│                                                                       │
│  4) 사이드바 → 카테고리별 운영 표면                                        │
│     ┌─ 회원 관리         /dashboard/users         (PIPA · force logout)   │
│     ├─ 디바이스 모니터링   /dashboard/devices       (배터리·BLE·페어링)      │
│     ├─ OTA 관리          /dashboard/ota           (배포·롤백)             │
│     ├─ AI 페르소나        /dashboard/personas      (SOUL · live/staged)   │
│     ├─ 리뷰·신고 관리      /dashboard/reports       (검토·처리)            │
│     ├─ 공지/배너 관리      /dashboard/notices       (active/pinned)       │
│     ├─ 푸시 알림 관리      /dashboard/push          (캠페인·delivery)      │
│     ├─ 통계 관리          /dashboard/stats         (DAU·매출·SLO)         │
│     ├─ 펌웨어 에러         /dashboard/firmware-errors  (ESP32 panic·OTA)   │
│     ├─ 서버 에러          /dashboard/server-errors   (AWS 5xx/4xx)        │
│     ├─ 앱 에러            /dashboard/app-errors      (RN crash · JS/Native)│
│     └─ 운영 안정성         /dashboard/ops             (9 항목 통합)        │
│                                                                       │
│  5) 액션 → audit trail                                                 │
│     강력 액션 (kill switch / OTA rollback / 페어링 해제 / force_logout) │
│        → EXECUTE 2단계 확인 + 사유 5자 강제                              │
│     일반 mutation (push retry / app issue / persona live)             │
│        → 사유 5자 + silent retry (3회 backoff) + 세션 trail              │
│     user.* 액션 → recordOperatorAuditAction (server canonical)         │
│                                                                       │
│  6) 로그아웃                                                            │
│     /api/v1/operator/logout 호출 (jti revoke best-effort) + 쿠키 삭제   │
│     → /login redirect                                                  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 2. 세부 항목 기능

### 2.1 페이지 / 패널 / 운영자 액션 표

| 경로 | 핵심 패널 | 운영자 액션 (audit prefix) | 데이터 소스 |
|---|---|---|---|
| `/dashboard` | 4 StatCard + 처리 대기 신고 / 펌웨어 critical / 서버 5xx / 앱 에러 최신 | (조회) | `mockData.ts` |
| `/dashboard/users` | StatCard 4종 (가입·DAU·일시정지·탈퇴 대기) · PIPA 권리 추적 패널 · 사용자 표 · 상세 drawer | force_logout / account_deleted **EXECUTE** + 사유 5자 → `user.*` server canonical | `searchUsers` · `getUserDetail` · `forceLogoutUser` |
| `/dashboard/devices` | StatCard 4 (총·online·저전력·미페어링) + 4 (페어링·FW에러·OTA진행·적용률) + **4 (BLE 페어링 실패·실패율·시도·kill switch ref)** + **배터리 분포 4-구간 카드** · 표 (FW에러 컬럼) · drawer | 페어링 해제 **EXECUTE** · OTA 강제 · 음소거 · 핑 → `device.*` 세션 trail | `listDevices` · `mockFirmwareErrors` |
| `/dashboard/ota` | 캠페인 표 · 상세 drawer (배포/일시중지/중단/롤백) · 실패 패널 | rollout_start/pause/abort/rollback **EXECUTE** + 사유 → `ota.*` 세션 trail | `mockOtaFirmwares` · `mockOpsActions` |
| `/dashboard/personas` | 목록 + drawer + composer modal · 실패 패널 | submit_review · go_live · archive **EXECUTE** · restore · retry → `persona.*` 세션 | `mockPersonas` |
| `/dashboard/reports` | 신고 표 + drawer | 차단 · 반려 · 경고 · 정지 → 백엔드 mutation 후 | `mockReports` |
| `/dashboard/notices` | 공지/배너 표 · 활성/예약 | (편집 mutation 백엔드 후) | `mockNotices` |
| `/dashboard/push` | 4 StatCard (도달·오픈·오픈율·예약) + **4 (Push 성공률·invalidated·실패 캠페인·Expo Receipts 자리)** · 표 · 실패 발송 패널 · composer | retry **사유 5자** → `push.*` 세션 + silent retry | `mockPush` · `mockOpsActions` |
| `/dashboard/stats` | DAU/가입/매출 StatCard 4 · 7일 추세 (bar chart) · **SLO — 사용자 인지된 에러율** · 플랫폼/요금제 분포 | (조회) | `mockStatsTimeseries` · `mockUserPerceivedErrorRate` |
| `/dashboard/firmware-errors` | 표 + drawer · CSV/JSON · 코드 → operator 라벨 매핑 | ota_retry · device_reboot → `firmware.*` 세션 | `mockFirmwareErrors` |
| `/dashboard/server-errors` | 표 + drawer · 코드 추정 (`inferCatalogCode`) | retry → `server.*` 세션 | `mockServerErrors` |
| `/dashboard/app-errors` | 4 StatCard (총·영향·iOS·Android) + **4 (JS crash·Native crash·crash-free session·Sentry 자리)** · 표 · drawer | create_issue · mark_resolved · force_update_hint → `app.*` 세션 | `mockAppErrors` |
| `/dashboard/ops` | 9 항목 통합 — observability(probe+SLO) · **AI timeout/fallback/p95** · alerting · tracing · replay/force-retry · recovery · kill switch · feature flag · audit log | ack · replay_force · recovery (일부 destructive **EXECUTE**) · kill_switch.* **EXECUTE** · feature_flag.update → 세션 trail (user.* 만 server canonical) | `mockHealthProbes` · `mockOpsAlerts` · `mockTraces` · `mockDeadLetters` · `mockKillSwitches` · `mockFeatureFlags` · `mockServerErrors` |

### 2.2 출시 진단 10 항목 — Admin 책임 매핑

| # | 항목 | 상태 | 위치 | 비고 |
|---|---|---|---|---|
| 1 | 실사용자 QA 가시화 | OK | `/dashboard/users` · `/dashboard/stats` | 가입·DAU·일시정지·탈퇴 StatCard + PIPA 패널 |
| 2 | 실제 네트워크 health probe + SLO | OK | `/dashboard/ops` 상단 4 StatCard + Probe 패널 · `/dashboard/stats` SLO 카드 | mock — `/api/v1/admin/ops/probes` 미연동 |
| 3 | 디바이스 reconnect / online | OK | `/dashboard/devices` StatCard (online·low·unpaired) + last_seen 표시 | 표 + drawer |
| 4 | AWS staging 환경 배지 | **신규 (본 라운드)** | Sidebar 헤더 우측 `<EnvBadge>` (PROD/STAGING/DEV) | `loadIconiaEnv()` (server-side) → Sidebar client prop |
| 5 | 실시간 로그 · tracing | OK | `/dashboard/firmware-errors` · `/server-errors` · `/app-errors` · `/dashboard/ops` tracing 패널 | 폴링형 mock — 백엔드 stream 도입 시 교체 |
| 6 | crash analytics | **확장 (본 라운드)** | `/dashboard/app-errors` 4 신규 StatCard | JS/Native 분리 · crash-free session · Sentry 연동 자리 명시 |
| 7 | AI timeout monitoring | **신규 (본 라운드)** | `/dashboard/ops` AI 호출 모니터링 패널 (4 StatCard) | p50/p95 · fallback rate · 마지막 fallback 시각 |
| 8 | battery / power 분포 | **신규 (본 라운드)** | `/dashboard/devices` 배터리 분포 4-구간 카드 | high ≥60% · mid 25~59% · low 10~24% · critical <10% |
| 9 | BLE 페어링 안정성 | **신규 (본 라운드)** | `/dashboard/devices` BLE 4 StatCard | 실패 수 · 실패율 · 시도 · kill switch 참조 |
| 10 | push delivery 가시화 | **확장 (본 라운드)** | `/dashboard/push` 신규 4 StatCard | 성공률 · invalidated · 실패 캠페인 · Expo Receipts 자리 |

### 2.3 에러 카탈로그 / 사용자 인지 정책

- 단일 카탈로그: `lib/errorCatalog.ts` (15종 — Firmware 5 · Server 5 · App 5).
- 각 entry 에 `userVisibility ∈ { silent · in-character · visible }` 필드 — SLO 카드의 분류 기반.
- `serverAliases` 로 Server `error-codes.md` 의 ~120 `ERR_*` 와 단일 방향 매핑.
- Lookup API: `operatorLabelForCode(code)` · `lookupErrorCode(code)` · `lookupCanonical(serverCode)` · `validateAliasUniqueness()`.

### 2.4 운영자 액션 정책

| 정책 | 적용 |
|---|---|
| **사유 입력 5자 이상** | 모든 mutating 액션 (push retry · force_logout · kill switch · feature flag 등) |
| **EXECUTE 2단계 확인** | kill switch 전 5종 · recovery destructive (OTA rollback · Persona recall · Device reset · force_logout_all) · `/dashboard/users` 의 force_logout/account_deleted · `/dashboard/devices` 페어링 해제 |
| **Silent retry** | 운영자 액션의 transient 실패 (5xx/timeout/network) 는 `runWithSilentRetry()` 가 3회 backoff (250ms·×2^n·지터±20%). 최종 실패 시에만 toast (`[N회 시도]` 포함) |
| **Audit 갈래** | `user.*` → `recordOperatorAuditAction` (server canonical, hash chain). `ops.*` / `recovery.*` / `kill_switch.*` / `feature_flag.*` / `firmware.*` / `server.*` / `app.*` / `push.*` / `persona.*` / `ota.*` → `recordOpsAuditWithSilentRetry` (세션 trail, sessionStorage) |
| **자동 재시도 불가 코드** | `PANIC_RTC_GPIO` · `CAM_INIT_FAIL` 등 `retryable === false` 인 코드는 재시도 버튼 비활성 + 토스트 차단 사유 |

### 2.5 환경 변수

| 변수 | 필수 | 용도 |
|---|---|---|
| `ICONIA_SERVER_URL` | ✓ | Server 베이스 URL (예: `https://api.iconia.example.com`) |
| `ICONIA_ENV` | ✗ | `development` / `staging` / `production` — **Sidebar 헤더 env 배지** 표시. 미설정 시 `NODE_ENV` fallback |
| `ADMIN_IDLE_TIMEOUT_MINUTES` | ✗ | 운영자 idle 자동 로그아웃 임계 (5~480, 기본 30) |
| `NODE_ENV` | (auto) | `production` 시 쿠키 `Secure=true` |

### 2.6 핵심 라이브러리

```
lib/
├── env.ts                  loadEnv / loadIconiaEnv / loadIdleTimeoutMinutes
├── types.ts                ServerEnvelope · ServerResult 등 도메인 타입
├── httpClient.ts           authedRequest — Bearer JWT + envelope unwrap + 5xx 합성
├── serverApi.ts            /operator/login · /mfa · /logout
├── adminApi.ts             /admin/users · /admin/devices · /admin/firmware · /admin/ai-health · /admin/posts · /commerce · /operators
├── auditApi.ts             listAuditLog / appendAuditLog (canonical hash chain)
├── errorCatalog.ts         15종 카탈로그 + userVisibility + serverAliases
├── errorMessages.ts        운영자 인증·세션 에러 → 한국어 토스트
├── exportData.ts           CSV (BOM 포함) · JSON Blob + a[download]
├── opsAuditTrail.ts        recordOpsAudit / recordOpsAuditWithSilentRetry (세션 trail)
├── opsInfraMock.ts         9 항목 통합 mock (probes · alerts · traces · dead-letters · kill-switches · feature-flags)
├── mockData.ts             18종 mock (users · reports · firmware/server/app errors · personas · devices · OTA · stats · SLO)
├── silentRetry.ts          runWithSilentRetry — 3회 backoff + transient 휴리스틱
├── identity.ts             JWT payload → { email } (단일 사용자, role 무시)
├── jwt.ts                  display-only payload decode
├── authCookie.ts           쿠키 단일 소유 (httpOnly + Strict)
├── maskPii.ts              운영자 표시용 마스킹
├── operatorRoles.ts        OperatorRole enum + PATH_REQUIRED_ROLES (UI gating 비활성)
└── actions/
    ├── login.ts · mfa.ts · logout.ts · idleLogout.ts
    ├── forceLogoutUser.ts (server action — server canonical audit 자동)
    ├── auditLog.ts  recordOperatorAuditAction
    ├── posts.ts · commerce.ts
```

---

## 3. 작업 완료된 범위

### 3.1 인증 / 세션 (Round 1)

- `/login` · `/login/mfa` · 로그아웃 (server jti revoke + httpOnly 쿠키 삭제 + redirect).
- `/dashboard` 보호 (middleware 쿠키 부재 → `/login` redirect).
- idle 자동 로그아웃 (기본 30 분, `ADMIN_IDLE_TIMEOUT_MINUTES` 5~480 분).
- 보안 헤더 (`X-Frame-Options` 등 `next.config.mjs`).
- 2FA TOTP scaffold (`/security/2fa` — Server P1 정합).

### 3.2 사용자 / 디바이스 / OTA / Persona (Round 2~4)

- `/dashboard/users` 검색 + 상세 + **강제 로그아웃** + **계정 삭제** (`EXECUTE` 2단계 확인 + 사유 5자, server canonical audit).
- 가입(48h)·DAU·일시정지·탈퇴 대기 StatCard + **PIPA 권리 추적 패널**.
- `/dashboard/devices` 검색·필터·드로어 — last_seen / 배터리 / Wi-Fi / FW에러 컬럼 · 페어링 해제 EXECUTE.
- `/dashboard/ota` 캠페인 · 배포/일시중지/중단/롤백 · 실패 액션 패널 — 사유 + EXECUTE.
- `/dashboard/personas` SOUL composer · live/staged/rollback — `persona.*` 세션 trail.

### 3.3 에러 / 운영 안정성 (Router → Admin Round 1~3)

- `/dashboard/firmware-errors` · `/server-errors` · `/app-errors` — 검색·필터·CSV/JSON·상세 drawer.
- `userVisibility` 컬럼 (silent / in-character / visible) — `/dashboard/stats` **SLO 카드** 와 정합.
- 운영자 액션 silent retry — transient 실패는 표시 없음, 최종 실패만 toast `[N회 시도]`.
- `/dashboard/ops` 9 항목 통합:
  - **observability** — probe 7건 (services × regions) · p50/p95/error_rate.
  - **tracing** — trace_id / request_id / endpoint 검색 + hop drawer + raw payload preview.
  - **alerting** — 활성/진정 알람 · severity/source/channels chip · ack (silent retry).
  - **audit log** — 본 세션 운영자 액션 통합 패널 + 각 페이지 prefix 별 패널.
  - **replay tool · force retry** — dead-letter 5건 · retryable=false 차단.
  - **recovery actions** — 5종 (OTA rollback · Persona recall · Push resend · Device reset · force_logout_all) — destructive EXECUTE.
  - **kill switch** — 5종 (ai.calls · push.send · ota.rollout · billing.webhook · ble.pairing) — 기본 OFF · EXECUTE 강제.
  - **feature flag** — 5종 (social_feed.v2 · commerce.checkout_v2 · persona.taro_beta · ai.bedrock_fallback · ota.canary_widen) — rollout_pct 0~100% slider.

### 3.4 API / 프로토콜 정합

- 모든 호출은 `lib/httpClient.ts` 의 단일 `authedRequest()` 경유 — Bearer JWT · JSON envelope unwrap · 5xx→`ERR_SERVER_UNAVAILABLE` · fetch throw→`ERR_NETWORK` · 비-JSON→`ERR_INVALID_RESPONSE`.
- ICONIA std envelope (`ServerEnvelope<T>`) — `ok / data / error / meta`.
- 펌웨어 deployment legacy 단수형 endpoint (`/api/admin/firmware/deployment/...`) 호환 — drift 차단 회귀 테스트 3건.
- `errorCatalog.serverAliases` 로 Server 카탈로그 ↔ Admin 라벨 단일 방향 매핑.
- `appendAuditLog` snake_case body 계약 (`target_user_id`, `payload_hash`, `reason_text`).

### 3.5 출시준비 라운드 (본 라운드, 2026-05-20)

10 항목 진단 — 작업 완료 매핑:

- **§4 환경 배지**: `app/dashboard/layout.tsx` 에서 `loadIconiaEnv()` 호출 → `Sidebar` 의 `EnvBadge` (PROD = chip-error · STAGING = chip-warn · DEV = chip-muted) 헤더 노출. 잘못된 환경에서의 실수 차단.
- **§6 crash analytics**: `/dashboard/app-errors` 에 JS crash · Native crash · crash-free session · Sentry 연동 자리 4 StatCard 추가. error_type prefix (`JS_*` vs `Native_*`) 로 자동 분류.
- **§7 AI timeout monitoring**: `/dashboard/ops` 에 "AI 호출 모니터링" 패널 신규 — ai-worker p95 (Gemini SLA 3,000ms 임계) · persona p95 · fallback rate (Gemini timeout+rate-limit / 전 server error) · 마지막 fallback 시각.
- **§8 battery/power 분포**: `/dashboard/devices` 에 4-구간 (high ≥60% · mid 25~59% · low 10~24% · critical <10%) 분포 패널 — 카운트 + 비율 + 막대.
- **§9 BLE 안정성**: `/dashboard/devices` 에 BLE 페어링 실패 / 실패율 / 시도 / kill switch 참조 4 StatCard. 실패율 임계 10% 초과 시 chip-pink + "임계 초과" delta.
- **§10 push delivery**: `/dashboard/push` 에 Push 성공률 (95% 임계) · invalidated 토큰 (DeviceNotRegistered/InvalidCredentials) · 실패 캠페인 수 · Expo Receipts endpoint 자리 4 StatCard.

### 3.6 상용 운영 패널 완성 라운드 (2026-05-20)

미구현 / 부분구현 / dead button 일괄 점검 후 출시 수준으로 완성:

- **RBAC 강제 활성화**: `middleware.ts` 가 JWT `role` 클레임으로 경로별 접근을 1차 차단 (권한 미달 시 `?reason=forbidden` redirect). `PATH_REQUIRED_ROLES` 를 실제 라우트에 매핑 (ops/ota/personas = SRE 이상, devices = secops 이상, users/reports = cs 이상). `Sidebar` 가 `canAccessPath` 로 네비게이션 링크 역할별 필터링 + 역할 배지 노출.
- **신고 처리 액션 wire**: 차단 / 반려 / 경고 / 계정정지 4개 dead button 실연결 — 차단·계정정지는 EXECUTE 2단계 확인, 전 액션 사유 입력 + 세션 audit trail 기록. 처리 현황 KPI 4종 추가.
- **공지 관리**: 편집 모달 (신규/편집 겸용) + 게시 중지/재개 토글 + 입력 검증.
- **푸시 관리**: 작성 / 편집 / 복사 모달 wire + 임시저장 / 예약발송 검증.
- **대시보드 홈 KPI**: 활성 디바이스 · DAU · 사용자 인지 에러율 · 큐 적체 · 24h 에러 · 서버 헬스 · 신고 대기 · 펌웨어 크리티컬 8개 KPI 를 underlying mock 에서 직접 집계. RBAC 차단 안내 배너 (`ForbiddenNotice`) 추가.

### 3.7 검증

- `npm run typecheck` 그린 (tsc --noEmit).
- `npm run lint` 그린 (No ESLint warnings or errors).
- `npm test` 그린 (240 tests passed — 27 test files, `operatorRoles.test.ts` 19종 신규, 회귀 0).
- `npm run build` 그린 (19 페이지 + 미들웨어 41kB 빌드, ICONIA_SERVER_URL env 만 필요).

---

## 4. 향후 작업 필요한 범위

### 4.1 백엔드 endpoint 연동 (mock → real swap)

| 항목 | 현 상태 | 백엔드 endpoint (도입 시 교체 지점) |
|---|---|---|
| 가입 / DAU / MAU 카운트 | `created_at` · `last_login_at` 48h 휴리스틱 | `/api/v1/admin/users/signups?since=...` · `/admin/users/activity` |
| PIPA export / restore | 패널 표시만 | `/api/v1/admin/users/<id>/pipa/export` · `/pipa/restore` |
| 디바이스 페어링 24h 카운터 | `paired_at` 48h 휴리스틱 | `/api/v1/admin/devices/pairings?since=...` (pair / unpair 양방) |
| 디바이스별 FW 에러 누적 | `mockFirmwareErrors` device_id 그룹화 | `/api/v1/admin/devices/<id>/firmware-errors?since=24h` |
| **BLE 페어링 실패율** | timeout / (paired + timeout) 근사 | `/api/v1/admin/devices/pairings` 의 (attempt, success) 카운터 |
| **배터리 분포** | `mockDevices.battery_pct` 정적 | `/api/v1/admin/devices/battery-distribution` 시계열 |
| **AI fallback rate / p95** | server error code + probe latency 근사 | `/api/v1/admin/ops/ai-health` (Gemini timeout · 429 · Bedrock fallback 적중률) |
| **Push delivery 성공률 / invalidated** | total - delivered 산술 | `/api/v1/admin/push/expo-receipts` (DeviceNotRegistered · InvalidCredentials · MessageRateExceeded) |
| **JS/Native crash analytics** | error_type prefix 분류 | Sentry release health (`/projects/iconia-app/releases/<v>/health`) |
| Health probe 시계열 | 정적 7건 | `/api/v1/admin/ops/probes` |
| Alerts list / ack | sessionState | `/api/v1/admin/ops/alerts` + Slack webhook (서버 측 CloudWatch alarm) |
| Trace hop | 시나리오 2종 정적 | `/api/v1/admin/ops/traces?trace_id=` + OTel/Jaeger |
| Dead-letter 큐 | `mockDeadLetters` | `/api/v1/admin/ops/dead-letters` + SQS DLQ |
| Recovery action 실행 | audit trail 만 | `/api/v1/admin/ops/recovery/<kind>` mutation |
| Kill switch 토글 | UI state + audit trail | `/api/v1/admin/ops/kill-switches` (서버 전역 store) |
| Feature flag 편집 | UI state + audit trail | `/api/v1/admin/ops/feature-flags` (LaunchDarkly 또는 in-house) |
| SLO 시계열 (사용자 인지 에러율) | `mockUserPerceivedErrorRate` 7일 mock | `/api/v1/admin/error-slo` |
| 세션 audit trail | sessionStorage | `appendAuditLog(...)` 호출로 내부만 교체 — UI 계약 그대로. Server `ALLOWED_ACTIONS` zod enum 에 `ops.*`/`recovery.*`/`kill_switch.*`/`feature_flag.*` 등록 필요 |
| 운영자 이메일 표시 | `"(현재 운영자 세션)"` | Server `/api/v1/operator/me` (P1 후속) |
| `listOperators / disableOperator` | `/api/v1/operator/admin/operators*` 호출 코드 있음 | Server 측 라우트 미확인 — PR 동기 또는 admin UI 비활성 결정 필요 |

### 4.2 RBAC (multi-operator) — 1차 구현 완료 (2026-05-20)

- ✅ `middleware.ts` 경로별 JWT `role` 차단 + `Sidebar` 역할별 메뉴 필터링 + 역할 배지 활성 (§3.6).
- ✅ `lib/operatorRoles.ts` 의 `PATH_REQUIRED_ROLES` 매트릭스가 실제 라우트에 매핑되어 동작.
- 남은 후속: `/dashboard/operators` 운영자 관리 페이지 신설 (server action `disableOperatorAction` 은 이미 존재), 운영자 초대 / 역할 부여 UI.
- 실제 권한 결정은 **항상 Server**. Admin 의 role check 는 1차 방어 + UX 표시.

### 4.3 보안 / 운영 강화

- **CSRF 이중 제출 토큰** — mutating 화면 도입 시 추가. 현재 `SameSite=Strict` 1차 방어.
- **Refresh token rotation** — Server family rotation 정합. Admin 측 silent refresh 흐름.
- **IP allowlist (operator 한정)** — 운영자 계정 차단/허용 IP 범위 화면.
- **2-eye rule** — Knowledge 삭제 / 정책 변경 등 중요 mutation 에 2인 승인.
- **2FA TOTP 정식화** — scaffold (`/security/2fa`) 존재 — Server P1 와 동기 활성화.

### 4.4 UI / UX 정식화

- **Tailwind / shadcn** — 현 Tailwind 토큰 + 커스텀 chip/glass 패턴. shadcn 도입은 디자인 시스템 라운드. App 의 Stitch 토큰과 정합 여부는 별도 결정.
- **i18n** — 현 한국어 하드코딩. ko / en 2-locale 분리.
- **Knowledge 큐레이션 화면 확장** — KB 소스 업로드 / 청크 미리보기 / 삭제 + audit log. 현 stub (`/api/v1/admin/rag/*`).

### 4.5 통계 / 카드 확장

- **MAU 카드** — `/dashboard/stats` 에 30일 활성 사용자.
- **상품별 SKU 분포** — `/dashboard/stats` 매출 패널 확장.
- **24h/7d 트렌드 시각화** — 각 에러 페이지의 StatCard 단순 카운트 → `/dashboard/stats` 시계열에 통합.
- **Gemini Bedrock fallback 적중률 시계열** — 본 라운드 fallback rate 정적 → feature flag `ai.bedrock_fallback` 활성 시 시계열로 확장.

### 4.6 테스트 / 자동화

- **Playwright E2E** — 실 Server fixture 또는 docker compose 기반. Knowledge / 인증 / RAG test-query / 새로 추가된 출시준비 카드의 happy path.
- **시각 회귀 (T33)** — RAG Slice 3 T33 디자인 패스 후 baseline 갱신.
- **Sentry / OTel 도입** — Server 와 동기. crash-free session % 카드의 mock → release health 실값.

### 4.7 P0 (RAG Slice 1 머지 후 follow-up — 단계 5 P1)

- `adminRagRoutes.js` rate-limit 키 정밀화 후 화면 반영 (operator 식별자 기반 카운터 표시).
- test-query audit 로그 노출 (operator 식별자 + query hash + backend label).
- citation `title` 렌더 — Server/AI 계약 확정 후 `QueryPanel.tsx` citation chip 라벨 변경.
- `X-RAG-Backend` 헤더 화이트리스트 검증 — Slice 2 후속 머지 후 UI 선택지(`mock` / `bedrock`) 확정.

### 4.8 비범위 (의도적으로 Admin 에서 처리하지 않음)

- 사용자(end-user) UI — App 도메인 (`App/`).
- KB 인덱싱 파이프라인 자체 — AI 도메인 (`AI/src/rag/`).
- 디바이스 OTA 배포 트리거 — Server 측 endpoint 정식화 후 별 라운드.
- 운영자 인증 권한 결정 — 항상 Server 측 JWT 검증이 정본.
