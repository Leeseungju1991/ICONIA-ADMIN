# ICONIA-ADMIN

ICONIA 운영자 콘솔. ICONIA-Server 의 `/api/v1/operator/*` · `/api/v1/admin/*`
라우트를 사람이 쓰기 좋은 화면으로 노출하는 Next.js 14 (App Router) 웹 앱.

- 스택: Next.js 14 · React 18 · Tailwind 3 · Zod · Vitest
- 패키지명: `iconia-admin-web`

> **★ localhost ↔ AWS 전환은 `.env` 의 `DEPLOY_TARGET` 한 줄만 바꾸면 됩니다.**
> `DEPLOY_TARGET=local` → 로컬, `DEPLOY_TARGET=aws` → AWS 운영. 자세한 내용은 §3 참조.

---

## 1. 설계 구조도

```
┌──────────────────────────────── ICONIA-ADMIN (Next.js 14) ────────────────────────────────┐
│                                                                                            │
│  /login ──MFA──▶ JWT 발급 (httpOnly · SameSite=Strict 쿠키)                                 │
│      │                                                                                     │
│      ▼                                                                                     │
│  middleware.ts (Edge)  ──쿠키 부재/만료──▶ /login                                            │
│      │  └─ RBAC: JWT role 클레임으로 경로별 1차 차단                                          │
│      ▼                                                                                     │
│  ┌─────────────────────────────── /dashboard ────────────────────────────────────┐         │
│  │  Sidebar (역할별 메뉴 필터)              헤더: [환경 배지] [역할 배지]            │         │
│  │                                                                                │         │
│  │  ┌── 홈 ───────────┐  ┌── 회원/디바이스 ──┐  ┌── 콘텐츠 운영 ──────┐            │         │
│  │  │ 핵심 KPI 8종     │  │ users   회원관리   │  │ reports  신고관리   │            │         │
│  │  │ 신고/FW/에러 요약│  │ devices 디바이스   │  │ notices  공지/배너  │            │         │
│  │  └─────────────────┘  │ ota     OTA 배포   │  │ push     푸시발송   │            │         │
│  │                       │ personas AI페르소나│  └─────────────────────┘            │         │
│  │  ┌── 에러/관측 ─────┐  └────────────────────┘  ┌── 통계/권한 ───────┐            │         │
│  │  │ firmware-errors  │  ┌── 운영 안정성 ─────┐  │ stats   통계·SLO    │            │         │
│  │  │ server-errors    │  │ ops: observability │  │ operators 운영자관리│            │         │
│  │  │ app-errors       │  │ tracing · alerting │  └─────────────────────┘            │         │
│  │  └──────────────────┘  │ replay · recovery  │                                    │         │
│  │                        │ kill switch · flag │   공통 표: DataTable               │         │
│  │                        └────────────────────┘   (대량 데이터 페이지네이션 내장)   │         │
│  └────────────────────────────────────────────────────────────────────────────────┘         │
│      │                                                                                     │
│      │  Server Action / RSC (브라우저는 Server 를 직접 호출하지 않음)                         │
│      ▼                                                                                     │
│  lib/env.ts ── DEPLOY_TARGET 토글 ──▶ lib/httpClient.ts (Bearer JWT · timeout · 재시도)      │
└──────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                           │  HTTPS
                                           ▼
                        ┌──────────────────────────────────────┐
                        │  ICONIA-Server (Express)              │
                        │  local: localhost:8080                │
                        │  aws  : https://api.iconia.example... │
                        │  ─ JWT 서명검증 (정본 권한 결정)        │
                        │  ─ canonical audit log (hash chain)   │
                        └──────────────────────────────────────┘
```

---

## 2. 동작 설명

관리자가 한 화면에서 ICONIA 서비스를 운영합니다. 사용자와 인형(디바이스)을 검색해
상태를 확인하고 강제 로그아웃·계정 정지 같은 조치를 내리며, AI 페르소나·펌웨어를
배포하고, 신고·공지·푸시를 처리합니다. 서버·앱·펌웨어 에러와 시스템 건강 상태를
실시간으로 지켜보다가 문제가 생기면 즉시 복구 액션을 실행합니다. 모든 강력한 조치는
사유 입력과 2단계 확인을 거쳐 감사 로그에 남습니다.

---

## 3. 기능

### 환경 전환 — localhost ↔ AWS 단일 토글

- `.env` 의 **`DEPLOY_TARGET` 한 줄**로 전체 환경 전환:
  - `DEPLOY_TARGET=local` → Server `localhost:8080` · 쿠키 비-Secure · DEV 배지
  - `DEPLOY_TARGET=aws` → 실 Server URL · 쿠키 Secure · PROD 배지 · HSTS
- `ICONIA_SERVER_URL` / `ICONIA_ENV` / `COOKIE_SECURE` 를 따로 만질 필요 없음 —
  `lib/env.ts` 가 토글 하나로 전부를 일관되게 결정.
- `aws` 토글은 안전장치 내장: Server URL 미설정이거나 평문 `http` 면 부팅 시 차단.

### 운영 화면

- **대시보드 홈** — 활성 디바이스·DAU·사용자 인지 에러율·큐 적체·24h 에러·서버 헬스·
  신고 대기·펌웨어 크리티컬 8종 KPI + 신고/에러 요약 패널.
- **회원 관리** — 검색·필터·상세 드로어. 강제 로그아웃·계정 정지·MFA 초기화·탈퇴 처리.
  PII 기본 마스킹, 해제는 감사 로그 기록. PIPA 권리 추적 패널.
- **디바이스 모니터링** — last seen·배터리 분포·Wi-Fi·BLE 페어링 안정성·FW 에러.
- **OTA 관리** — 펌웨어 채널 배포·일시중지·중단·롤백.
- **AI 페르소나** — SOUL 파일 검수·라이브 전환·롤백.
- **리뷰·신고 / 공지·배너 / 푸시** — 검토·처리, 등록·편집, 캠페인 발송.
- **통계** — DAU·가입·매출 추세 + 사용자 인지 에러율 SLO 카드.
- **에러 로그** — 펌웨어·서버·앱 에러 검색·필터·CSV/JSON 내보내기·상세 드로어.
- **운영 안정성** — observability·tracing·alerting·audit·replay·recovery·
  kill switch·feature flag 9항목 통합 + AI 호출 모니터링(실 연동).
- **운영자 관리** — 운영자 초대·역할·비활성화 (최고관리자 전용).

### 양산화 / 안정성

- **대량 데이터** — 공통 `DataTable` 이 클라이언트 페이지네이션 내장. 수만 행이
  들어와도 한 화면 DOM 노드를 페이지 크기로 상한선 고정 → 렌더 비용 일정.
- **API 안정성** — 모든 Server 호출은 `lib/httpClient.ts` 단일 경유. Bearer JWT ·
  envelope unwrap · 10초 timeout(AbortController) · 5xx/네트워크/비-JSON 을
  코드로 graceful 매핑하여 절대 throw 하지 않음.
- **로딩/에러/빈 상태** — 모든 표·패널에 빈 상태 메시지, Server 도달 불가 시
  mock degrade(예: AI 호출 패널) 또는 명시적 에러 안내.
- **운영자 액션 재시도** — transient 실패는 `runWithSilentRetry`(3회 backoff),
  최종 실패만 toast.

### 보안

- **인증** — `/login` + MFA(TOTP), JWT httpOnly + `SameSite=Strict` 쿠키.
- **RBAC** — `middleware.ts` 가 JWT `role` 로 경로별 1차 차단, Sidebar 가 역할별
  메뉴 필터링. 정본 권한 결정은 항상 Server.
- **감사 로그** — `user.*` 액션은 Server canonical hash chain, 그 외는 세션 trail.
  강력 액션은 사유 5자 + `EXECUTE` 2단계 확인.
- **PII 마스킹** — 회원 이메일·이름·ID 기본 마스킹, 해제 시 감사 로그.
- **보안 헤더** — CSP·HSTS(운영)·X-Frame-Options·COOP/CORP (`next.config.mjs`).
- idle 자동 로그아웃 (기본 30분, `ADMIN_IDLE_TIMEOUT_MINUTES`).

### 환경 변수

| 변수 | 필수 | 용도 |
|---|---|---|
| `DEPLOY_TARGET` | △ | **`local` / `aws` 단일 토글.** 미설정 시 `local` |
| `ICONIA_SERVER_URL` | △ | Server URL. `aws` 토글에서만 필수 (https) |
| `ICONIA_ENV` | ✗ | 환경 배지 override. 미설정 시 토글로 추론 |
| `ADMIN_IDLE_TIMEOUT_MINUTES` | ✗ | idle 로그아웃 임계 (5~480, 기본 30) |
| `ADMIN_ALLOWED_ORIGIN` | ✗ | Server Action 허용 origin (운영) |

---

## 4. 추가 고려 개발항목

상용 운영 전 남은 과제.

### 백엔드 endpoint 연동 (mock → real swap)

- 일부 화면은 아직 `mockData.ts` / `opsInfraMock.ts` 기반. Server 라우트가
  존재하는 항목(`/operator/me`, `/admin/ai-health`, `/admin/audit-log`,
  `/operator/admin/operators*`, `/admin/users*` 등)은 실 연동 완료.
- 미존재 라우트는 Server 도입 후 swap 대상: `ops/probes` · `ops/alerts` ·
  `ops/traces` · `dead-letters` · `kill-switches` · `feature-flags` ·
  `error-slo` · `expo-receipts` · `battery-distribution` · `users/signups` ·
  `pipa/*` · `devices/pairings`.
- 세션 audit trail(sessionStorage) → Server `appendAuditLog` 연결. Server
  `ALLOWED_ACTIONS` enum 에 `ops.*`/`recovery.*`/`kill_switch.*`/`feature_flag.*` 등록 필요.

### 대량 데이터 서버 사이드 전환

- 현재 페이지네이션·검색·필터는 클라이언트 측. 실사용 데이터가 수십만 건을
  넘어가면 Server 측 커서 페이지네이션 + 인덱스 검색 endpoint 로 전환 필요.
- 모니터링 패널은 폴링형 — Server SSE/WebSocket stream 도입 시 실시간성 강화.

### 보안 / 운영 강화

- Refresh token rotation 의 Admin 측 silent refresh 흐름.
- 운영자 IP allowlist 화면 (Server 라우트 도입 후).
- 중요 mutation 2-eye(2인 승인) 워크플로.
- 2FA TOTP 정식화 (현재 `/security/2fa` scaffold).
- 운영자 초대 — Server 초대 라우트 도입 후 audit-only → 실 mutation 전환.

### 관측성 / 테스트

- Sentry / OpenTelemetry 도입 — crash-free session % · trace hop 실값화.
- Playwright E2E — 실 Server fixture 또는 docker compose 기반.
- 시각 회귀 테스트 baseline.

### UI / UX

- i18n — 현재 한국어 하드코딩, ko/en 분리.
- 디자인 시스템 정식화 (shadcn 등).
- MAU 카드 · SKU 분포 등 통계 확장.

### 비범위 (의도적으로 Admin 에서 처리하지 않음)

- 사용자(end-user) UI — App 도메인.
- KB 인덱싱 파이프라인 — AI 도메인.
- 운영자 권한 결정 — 항상 Server JWT 검증이 정본.

---

## 5. 최근 라운드 (Phase 5~11) 누적 변경

Server 측 신규 33개 endpoint 와 1:1 정합하는 운영자 화면 라운드. 신규 페이지 9개 + Live*Panel 12개 +
PII 마스킹 해제 3중 가드 + TOTP 백업 코드 흐름. 기존 화면·라우팅은 그대로 두고 추가.

### 5.1 신규 페이지 9개
- `/dashboard/cs` — CS lookup (전화/이메일 정규화)
- `/dashboard/knowledge` — RAG KB 검수
- `/dashboard/factory-test` — 양산 라인 self-test 결과 조회
- `/dashboard/as` — AS 교환 티켓
- `/dashboard/reports-archive` — 월간/분기 OpsReport 아카이브
- 신규 client 함수 **33개** (Server 측 신규 admin endpoint 와 1:1 매핑)

### 5.2 Live*Panel 12개
`LiveUsersPanel` · `LivePipaPanel` · `LiveDevicesPanel` · `FleetDistributionPanel` ·
`OwnershipTimeline` · `BootInvariantsPanel` · `LivePersonaStatus` · `LiveFirmwareFailures` ·
`LiveDeploymentsPanel` · `DeploymentLedgerPanel` · `LiveDlqSubPanel` · `CostDashboardPanel`

### 5.3 운영 안정성 / 보안
- `MockDataBanner` — Server 미구현 페이지(notices / push / server-errors / app-errors)에서
  **데모 데이터임을 명시**. 운영자가 mock 을 실데이터로 오인하지 않도록 시각 가드.
- **PII 마스킹 해제 3중 가드** — 경고 모달 → 사유 prompt(5자 이상) → audit 기록 (Server `?unmask=true` 와 정합).
- `BackupCodePanel` — TOTP 10개 백업 코드 발급 + CSV 다운로드 + 단일 사용 표시.
