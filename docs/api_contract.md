# Admin Web → ICONIA Server API 매핑 (H-15 spec)

> **정본 (canonical sources) — 본 문서가 어긋나면 아래가 우선:**
> - 표면(엔드포인트·인증·봉투) 인덱스: 루트 `docs/api-contracts.md` §2 "admin ↔ Server" + §7 인증 매트릭스.
> - 라우트 스키마/응답: `Server/docs/api-spec/openapi.yaml` (admin 라우트는 `/api/admin/*` 및 `/api/v1/admin/*` 으로 등재).
> - RBAC 매트릭스: `Server/src/middleware/adminGate.js` (`adminGate({ allowedRoles })`) — route 별 `allowedRoles` 가 단독 정본.
> - 실제 라우트 구현: `Server/src/routes/{operatorRoutes,adminRoutes,adminUserRoutes,adminStubRoutes,auditLogRoutes}.js` + `Server/src/modules/commerce/commerceRoutes.js`.
>
> 아래 표는 본 라운드에 admin-web 이 실제 호출하는 경로를 정확히 반영하도록 보정됨 (2026-05-13). 아직 Server 에 미존재하는 endpoint 는 명시(❌)했다. path prefix 가 불확실한 항목은 `<!-- TODO verify -->` 로 표시했다.

본 web 이 호출할 Server endpoint 목록 + 각 화면 매핑.

## 인증 (실제 Server 라우트 — `Server/src/routes/operatorRoutes.js`)

| Endpoint | 용도 |
|---|---|
| `POST /api/v1/operator/login` | email + password → `mfa_session_token` |
| `POST /api/v1/operator/login/mfa` | `mfa_session_token` + (`totp` 또는 `recovery_code`) → JWT |
| `POST /api/v1/operator/logout` | jti revoke (Bearer JWT) |
| `GET  /api/v1/operator/me` | **구현됨** (`Server/src/routes/operatorRoutes.js`, `requireOperator` 모든 role) → `data: { id, email, role }`. 표시용 신원 (서명 검증됨). 인가 결정은 여전히 서버 `requireOperator` 가 수행 — 이 응답은 신뢰 경계가 아니다. *(admin-web `readIdentityFromJwt` unsafe-decode 경로는 점진 전환 대상 — §7.7)* |

> 본 라운드 admin-web 은 위 4개 endpoint 중 login / login/mfa / logout 3개만 호출합니다.

## Users — 실제 prefix: `/api/v1/admin/...` (`Server/src/routes/adminUserRoutes.js`)

| Endpoint | 용도 | 화면 |
|---|---|---|
| `GET  /api/v1/admin/users?email=&limit=` | 검색 (`adminGate` ALL_ROLES) | Users list |
| `GET  /api/v1/admin/users/:id` | 상세 + `active_session_count` (ALL_ROLES) | Users detail |
| `POST /api/v1/admin/users/:id/force-logout` | refresh family 전부 revoke (ALL_ROLES) | Users detail |
| `POST /api/v1/admin/users/:id/pause` | ❌ 미구현 — 다음 라운드 (adminUserRoutes 확장) | Users detail |
| `POST /api/v1/admin/users/:id/resume` | ❌ 미구현 | Users detail |
| `POST /api/v1/admin/users/:id/restore` | ❌ 미구현 (pending_deletion 취소) | Users detail |
| `POST /api/v1/admin/users/:id/password-reset/issue` | ❌ 미구현 | Users detail |
| `DELETE /api/v1/admin/users/:id/totp` | ❌ 미구현 (TOTP 비활성, 사용자 분실 대응) | Users detail |

> 본 라운드 구현분은 `searchUsers` / `getUserDetail` / `forceLogoutUser` 3개 (`admin/lib/adminApi.ts`). 나머지는 Server `adminUserRoutes` 확장 대기.

## Devices — list/detail/관리 액션: `/api/v1/admin/...` (`Server/src/routes/adminStubRoutes.js`); reprovision 만 legacy `/api/admin/...` (`Server/src/routes/adminRoutes.js`)

| Endpoint | 용도 |
|---|---|
| `GET  /api/v1/admin/devices?q=&status=&cursor=&limit=` | 검색 (`adminGate` ALL_ROLES) |
| `GET  /api/v1/admin/devices/:deviceId` | 상세 + `ota_history` (ALL_ROLES) |
| `POST /api/v1/admin/devices/:deviceId/force-unpair` | 운영자 unpair (SRE+) |
| `POST /api/v1/admin/devices/:deviceId/mark-lost` | 분실 마킹 (SRE+) |
| `POST /api/admin/devices/:deviceId/reprovision` | enter_provisioning 강제 — **legacy prefix 그대로** (`/api/admin/...`, SRE+, `legacyDeny=false`) |
| `GET  /api/admin/devices/:id/diagnostics` | 디바이스 진단 — legacy prefix (`/api/admin/...`, ALL_ROLES) |
| `POST /api/admin/devices/:deviceId/silence` | ❌ 미구현 (즉시 발화 정지) — 추가 시 prefix 확정 필요 <!-- TODO verify --> |

> admin-web `lib/adminApi.ts` 는 list/detail/force-unpair/mark-lost 4개만 호출. reprovision/diagnostics 는 Server 에는 있으나 admin-web 미연결.

## Firmware — `/api/v1/admin/firmware...` (`Server/src/routes/adminStubRoutes.js`)

| Endpoint | 용도 |
|---|---|
| `GET  /api/v1/admin/firmware` | versions + deployments 목록 (`adminGate` ALL_ROLES) |
| `POST /api/admin/firmware/deployment/:id/abort` | **pause 의미로 매핑됨** (admin client `pauseDeployment`) — Server `firmwareDeploymentRoutes.js` (SRE+) |
| `POST /api/admin/firmware/deployment/:id/resume` | 재개 — Server `firmwareDeploymentRoutes.js` (SRE+) |
| ~~`POST /api/v1/admin/firmware/deployments/:deploymentId/pause`~~ | ❌ adminStubRoutes 에서 항상 501 — admin client 미사용 (P0 §5.1.10c) |
| ~~`POST /api/v1/admin/firmware/deployments/:deploymentId/resume`~~ | ❌ adminStubRoutes 에서 항상 501 — admin client 미사용 (P0 §5.1.10c) |
| `POST /api/v1/admin/firmware/deployments` | ❌ 미구현 (새 deployment 시작) — 다음 라운드 |
| `POST /api/v1/admin/firmware/deployments/:id/rollback` | ❌ 미구현 (N-1 rollback) — 추가 시 SuperAdmin + `legacyDeny=true` 예정 |

> 별도의 `Server/src/routes/firmwareDeploymentRoutes.js` 는 HW(디바이스) 측 OTA progress + 운영자 abort/resume legacy 채널.
> admin client 의 pause/resume 은 Server v1 stub (501) 대신 이 legacy 단수형 endpoint 로 매핑됨 (drift 해소, P0 §5.1.10c).
> "pause"=abort 의미 동등성은 후속 작업으로 Server 측에서 분리 예정.

## Reports / Moderation (게시물 모더레이션) — `/api/v1/admin/posts...` (`Server/src/routes/adminStubRoutes.js`)

| Endpoint | 용도 |
|---|---|
| `GET  /api/v1/admin/posts?filter=all\|reported\|hidden&cursor=&limit=` | 신고/숨김 게시물 목록 (`adminGate` ALL_ROLES) |
| `POST /api/v1/admin/posts/:postId/hide` | 게시물 숨김 (SRE+) |
| `POST /api/v1/admin/posts/:postId/unhide` | 숨김 해제 (SRE+) |
| `GET  /api/admin/reports?category=&from=&to=` | ❌ 미구현 (message_reported audit 검색) — 추가 시 prefix 확정 필요 <!-- TODO verify --> |
| `POST /api/admin/moderation/patterns` | ❌ 미구현 (confirmed_pattern 추가) <!-- TODO verify --> |

## Audit — `GET /api/v1/admin/audit-log` (`Server/src/routes/auditLogRoutes.js`)

| Endpoint | 용도 |
|---|---|
| `GET /api/v1/admin/audit-log?action=&operator_id=&target_resource_type=&since=&cursor=&limit=` | audit 로그 조회 — **secops/sre/superadmin 전용** (`adminGate({ allowedRoles: ["secops","sre","superadmin"], legacyDeny: true })`). 응답 항목에 `prev_hash`/`current_hash`/`sequence_no` hash-chain 필드 포함 (변조 검증용). |
| `GET /api/admin/audit/verify-chain` | ❌ 미구현 (hash chain 무결성 일괄 검증) <!-- TODO verify prefix --> |
| `GET /api/admin/audit/export?format=csv&from=&to=` | ❌ 미구현 (컴플라이언스 export) <!-- TODO verify prefix --> |

> admin-web `lib/auditApi.ts` 가 `/api/v1/admin/audit-log` 만 호출. 다만 admin-web 은 단일 Owner(=superadmin 부트스트랩)로 동작하므로 secops/sre/superadmin gate 를 항상 통과.

## SRE Dashboard — AI health: `/api/v1/admin/ai-health` (`Server/src/routes/adminStubRoutes.js`); quota/metrics 는 legacy `/api/admin/...`

| Endpoint | 용도 |
|---|---|
| `GET /api/v1/admin/ai-health` | AI health tracker 현재 상태 (`adminGate` ALL_ROLES) |
| `GET /api/admin/quota/:subjectKey` | 사용자별 quota — **legacy prefix** (`/api/admin/...`, `Server/src/routes/adminRoutes.js`, ALL_ROLES) |
| `GET /api/admin/metrics/retry-summary` | ❌ 미구현 (retry hot-spot) <!-- TODO verify prefix --> |

## Operators — `/api/v1/operator/admin/operators...` (`Server/src/routes/adminStubRoutes.js`)

| Endpoint | 용도 |
|---|---|
| `GET  /api/v1/operator/admin/operators` | 운영자 목록 — **superadmin 전용** (`adminGate({ allowedRoles: ["superadmin"] })`) |
| `POST /api/v1/operator/admin/operators/:operatorId/disable` | 운영자 비활성 — superadmin 전용 |

## Commerce — products/sync: `/api/v1/commerce/...` (`Server/src/modules/commerce/commerceRoutes.js`); orders/webhooks: `/api/v1/admin/commerce/...` (`Server/src/routes/adminStubRoutes.js`)

| Endpoint | 용도 |
|---|---|
| `GET  /api/v1/commerce/products?cursor=&limit=` | 상품 목록 (optionalAuth — admin JWT 첨부) |
| `POST /api/v1/commerce/sync/products` | WooCommerce → 상품 동기화 (admin) |
| `POST /api/v1/commerce/sync/categories` | 카테고리 동기화 (admin) |
| `POST /api/v1/commerce/sync/orders` | 주문 동기화 (admin) |
| `GET  /api/v1/admin/commerce/orders?cursor=&status=&limit=` | 주문 목록 — **payment_method/transaction_id/billing 카드 정보 제외** projection (`adminGate` ALL_ROLES) |
| `GET  /api/v1/admin/commerce/webhooks?cursor=&limit=&only_failures=1` | WooCommerce webhook 이벤트 로그 (ALL_ROLES) |

## 권한 (RBAC)

> 이 절의 framing 은 루트 `docs/api-contracts.md` §2.2 "RBAC 게이트" 와 일치시킨다.

Server 측 RBAC 매트릭스는 **실재**한다 — 4단계 role: **CS / SRE / SecOps / SuperAdmin**.
라우트마다 `adminGate({ allowedRoles: [...] })` 미들웨어가 붙으며(`Server/src/middleware/adminGate.js`),
`allowedRoles` 가 단독 정본이다 (위 표의 괄호 표기는 참고용 — 코드가 우선).
부트스트랩 시 첫 운영자는 `superadmin` 으로 발급되므로 (`Server/src/services/operatorService.js`)
위 표의 모든 endpoint 에 도달 가능하다.

본 라운드 **admin-web 은 단일 운영자(Owner) 전용** 으로 운영되며 화면에서 RBAC 분기를 하지 않는다
— 모든 endpoint 를 동일한(부트스트랩 superadmin) JWT 로 호출하고 role 을 표시/분기하지 않는다.
그러나 위 "Server 측은 role 컬럼을 무시한다"는 식의 표현은 오해다: Server 는 매 요청에서
`requireOperator(allowedRoles)` 로 실제 인가를 수행한다 (`me` 응답의 `role` 은 표시용이며 신뢰 경계가 아님 — §7.7).
다음 라운드에서 추가 운영자 가입 시 별도 role 발급 + admin-web UI 분기를 도입한다.

`adminGate` 는 레거시 `X-Admin-Token` 도 동시 호환한다 (`allowLegacyAdminToken=true`): Bearer 가 없고
`X-Admin-Token` 만 있으면 `requireAdminToken` 로 통과시키되 deprecation 경고를 audit 한다. 단,
`legacyDeny: true` 로 표시된 강권한 endpoint (deployment rollback, operator create/disable, audit-log)
는 레거시 토큰으로 접근 불가 — Operator JWT 필수.

## 에러 코드 카탈로그 (정합 노트, E2E QC 2026-05-20)

`admin/lib/errorCatalog.ts` 는 **운영 대시보드 표시용** 디바이스/인프라/런타임 에러 분류 (`OTA_DOWNLOAD_FAIL`, `BLE_GATT_TIMEOUT`, `PG_POOL_EXHAUSTED`, `GEMINI_GATEWAY_TIMEOUT`, `GEMINI_RATE_LIMITED`, `WOO_BAD_GATEWAY`, `EFS_MOUNT_LAG`, `JS_TypeError`, `Native_BLE`, `Native_Audio`, `JS_Promise`, `Native_Storage`, `PANIC_RTC_GPIO`, `BATTERY_ADC_OUT_OF_RANGE`, `CAM_INIT_FAIL` — 총 12종 + 미분류 fallback)다. 이 코드들은 **Server 응답 봉투의 `error.code` 와는 별개 네임스페이스**다.

| 카탈로그 | 정본 위치 | 사용처 |
|---|---|---|
| Server 응답 `error.code` (정본 ~120종) | `Server/docs/error-codes.md` §1~§11 | App 분기, Server 라우트, AI fallback, RAG 라우트 |
| admin operator 인증 에러 → 한국어 메시지 | `admin/lib/errorMessages.ts` | login/MFA/logout 화면 |
| admin 운영 대시보드 에러 분류 (디바이스/인프라/런타임) | `admin/lib/errorCatalog.ts` | firmware-errors / server-errors / app-errors 표시 |

**현재 한계**: `errorCatalog.ts` 의 12종 코드는 Server 정본(`ERR_*` 접두 카탈로그)과 **이름 체계가 다르며 매핑이 없다**. 예를 들어 `GEMINI_GATEWAY_TIMEOUT` 은 Server 의 `ERR_LLM_TIMEOUT` 과 의미상 동치이지만 카탈로그에 그 동치성이 명시되어 있지 않다. Server 에서 발생한 `ERR_LLM_TIMEOUT` 이 운영 대시보드에 들어올 때 `errorCatalog.lookupErrorCode("ERR_LLM_TIMEOUT")` 호출은 "unknown" 으로 fallback 한다.

**조치 backlog (위임 — `aws-infra` / `admin` 도메인 코드 변경)**:
1. `errorCatalog.ts` 에 Server 정본 `ERR_*` 코드(`ERR_LLM_TIMEOUT/UNAVAILABLE/BLOCKED`, `ERR_VISION_*`, `ERR_TTS_*`, `ERR_RATE_LIMIT`, `ERR_RAG_*`, `ERR_DEPENDENCY_UNAVAILABLE` 등)에 대한 entry 추가 또는 `aliasOf` 매핑 도입.
2. Server `error-codes.md` § 11 (도메인별 코드) 변경 시 admin `errorCatalog.ts` 동시 갱신을 정합성 책무에 추가 (`docs/api-contracts.md` §8 표).

## CSRF / 보안

- 모든 mutating endpoint 는 `X-CSRF-Token` 헤더 필요 (Server 측에서 cookie ↔ header double-submit pattern).
- Operator JWT 는 httpOnly cookie + Secure + SameSite=Strict (`admin/lib/authCookie.ts`).
- 본 web 도메인은 ICONIA-SERVER 와 분리. CORS 는 `admin.iconia.example.com` (운영 시 `ADMIN_ALLOWED_ORIGIN` env) 만 허용.
- admin-web → Server 호출은 서버사이드 fetch wrapper (`admin/lib/{adminApi,auditApi}.ts`, `admin/lib/api/rag.ts`) 에서 `Authorization: Bearer <operator-jwt>` 첨부.
