# Admin Web → ICONIA Server API 매핑 (H-15 spec)

본 web 이 호출할 Server endpoint 목록 + 각 화면 매핑.

## 인증 (실제 Server 라우트 — `Server/src/routes/operatorRoutes.js`)

| Endpoint | 용도 |
|---|---|
| `POST /api/v1/operator/login` | email + password → `mfa_session_token` |
| `POST /api/v1/operator/login/mfa` | `mfa_session_token` + (`totp` 또는 `recovery_code`) → JWT |
| `POST /api/v1/operator/logout` | jti revoke (Bearer JWT) |
| `GET  /api/v1/operator/me` | **Server 미구현** — 현재 admin-web 은 JWT payload 를 unsafe-decode 하여 email/role 만 표시 (서명 검증 없음, 인가 결정 아님). `/me` 추가 시 swap. |

> 본 라운드 admin-web 은 위 4개 endpoint 중 login / login/mfa / logout 3개만 호출합니다.

## Users

| Endpoint | 용도 | 화면 |
|---|---|---|
| `GET  /api/admin/users?email=&limit=` | 검색 | Users list |
| `GET  /api/admin/users/:id` | 상세 | Users detail |
| `POST /api/admin/users/:id/pause` | 처리 정지 (대행) | Users detail |
| `POST /api/admin/users/:id/resume` | 재개 | Users detail |
| `POST /api/admin/users/:id/restore` | pending_deletion 취소 | Users detail |
| `POST /api/admin/users/:id/force-logout` | refresh family 전부 revoke | Users detail |
| `POST /api/admin/users/:id/password-reset/issue` | 비밀번호 reset 메일 재발송 | Users detail |
| `DELETE /api/admin/users/:id/totp` | TOTP 비활성 (사용자 분실 대응) | Users detail |

> 본 라운드 일부 endpoint 는 Server 에 미존재 — 별 라운드에서 추가 (operatorRoutes 확장).

## Devices

| Endpoint | 용도 |
|---|---|
| `GET  /api/admin/devices?hw_device_id=&user_id=` | 검색 |
| `GET  /api/admin/devices/:id` | 상세 |
| `POST /api/admin/devices/:id/reprovision` | enter_provisioning 강제 |
| `POST /api/admin/devices/:id/silence` | 즉시 발화 정지 |
| `POST /api/admin/devices/:id/unpair` | 운영자 unpair |

## Firmware

| Endpoint | 용도 |
|---|---|
| `GET  /api/admin/firmware/deployments` | 진행 중/최근 deployment 목록 |
| `POST /api/admin/firmware/deployments` | 새 deployment 시작 (holding) |
| `POST /api/admin/firmware/deployment/:id/start` | hold → start |
| `POST /api/admin/firmware/deployment/:id/hold` | 진행 hold |
| `POST /api/admin/firmware/deployment/:id/rollback` | N-1 rollback |

## Reports / Moderation

| Endpoint | 용도 |
|---|---|
| `GET  /api/admin/reports?category=&from=&to=` | message_reported audit 검색 |
| `POST /api/admin/reports/:id/resolve` | 검토 완료 마킹 |
| `POST /api/admin/moderation/patterns` | confirmed_pattern 추가 |

## Audit

| Endpoint | 용도 |
|---|---|
| `GET  /api/admin/audit?from=&to=&action=&user_id=&operator_id=` | 검색 |
| `GET  /api/admin/audit/verify-chain` | hash chain 무결성 검증 |
| `GET  /api/admin/audit/export?format=csv&from=&to=` | 컴플라이언스 export |

## SRE Dashboard

| Endpoint | 용도 |
|---|---|
| `GET  /api/admin/health/ai` | AI health tracker 현재 상태 |
| `GET  /api/admin/quota/:subjectKey` | 사용자별 quota (이미 존재) |
| `GET  /api/admin/metrics/retry-summary` | retry hot-spot |

## 권한

본 admin-web 은 **단일 운영자(Owner) 전용** 으로 운영되며, RBAC 분기를 하지
않습니다. Server 측은 여전히 role 컬럼을 가지고 있을 수 있으나, admin-web 은
모든 endpoint 에 동일한 권한으로 접근하며 role 을 표시/분기하지 않습니다.

## CSRF / 보안

- 모든 mutating endpoint 는 `X-CSRF-Token` 헤더 필요 (Server 측에서 cookie ↔ header double-submit pattern).
- Operator JWT 는 httpOnly cookie + Secure + SameSite=Strict.
- 본 web 도메인은 ICONIA-SERVER 와 분리. CORS 는 `admin.iconia.example.com` 만 허용.
