# `iconia-admin-web` 로그인 기능 — 디자인 스펙

- **작성일**: 2026-05-08
- **작성자**: Claude (superpowers brainstorming workflow)
- **대상 컴포넌트**: `iconia-admin-web` (Operator/CS/SRE 운영 콘솔)
- **상태**: design draft — pending user review
- **다음 단계**: superpowers `writing-plans` 로 구현 계획 작성 → TDD 실행

---

## 1. 목적

ICONIA 운영팀이 `iconia-admin-web` 에 안전하게 로그인하고, 보호된 운영 화면으로 진입할 수 있는 최소 기능을 구축한다. 본 라운드는 **로그인 + MFA + 로그아웃 + 보호된 placeholder 대시보드**까지 — 운영 콘솔 본격 화면(Users/Devices/Audit 등)은 별도 라운드.

성공 기준:
1. 운영자가 이메일+비밀번호+TOTP(또는 복구 코드)로 로그인하면 `/dashboard` 에 도달하고 본인 email + role 이 표시된다.
2. JWT 는 어떤 경우에도 클라이언트 자바스크립트가 접근할 수 없다 (httpOnly).
3. 로그아웃하면 ICONIA-Server 의 jti 가 revoke 되고 쿠키가 즉시 삭제된다 (Server 호출 실패 시에도 쿠키는 무조건 정리 — best-effort).
4. 모든 핵심 동작이 Vitest 단위/통합 + 단일 Playwright E2E 로 검증된다.

비목표 (out of scope):
- Users/Devices/Firmware/Audit/Reports 화면.
- CSRF 이중 제출 토큰 (현 라운드는 SameSite=Strict 만으로 1차 방어; mutating 화면 추가 시 별도 라운드).
- IP allowlist, 2-eye rule, Read-only Mode 같은 고급 정책.
- Refresh token rotation UI (Server 가 refresh 발급할 경우 별 라운드).
- i18n (한국어 메시지 하드코딩, 추후 i18n 라이브러리 도입 시 마이그레이션).

---

## 2. 제약 조건 (Locked)

| 항목 | 결정 |
|---|---|
| 위치 | `iconia-admin-web/` (greenfield, src/ 비어 있음 — Next.js init 본 라운드에 포함) |
| 프레임워크 | Next.js 14 App Router + TypeScript |
| 스타일 | TailwindCSS + shadcn/ui (`Card`, `Input`, `Button` 정도) |
| 테스트 | Vitest + React Testing Library + Playwright (E2E 1개) |
| Auth 패턴 | Next.js BFF — JWT 는 httpOnly 쿠키, 절대 브라우저 JS 노출 안 함 |
| Backend | 기존 ICONIA-Server `/api/v1/operator/...` (수정 없음) |
| MFA | TOTP + recovery code 모두 지원 |
| Cookie 정책 | `iconia_admin_session` · httpOnly · Secure(prod) · SameSite=Strict · Path=/ · Max-Age=Server 만료까지 |

### 백엔드 엔드포인트 (실제 — `Server/src/routes/operatorRoutes.js` 확인)

| Method | Path | 용도 |
|---|---|---|
| POST | `/api/v1/operator/login` | 1단계: email + password → `mfa_session_token` (또는 직접 JWT) |
| POST | `/api/v1/operator/login/mfa` | 2단계: `mfa_session_token` + `totp` 또는 `recovery_code` → JWT |
| POST | `/api/v1/operator/logout` | Bearer JWT → jti revoke |
| GET | `/api/v1/operator/me` | **현재 Server 미구현** (api_contract.md 가 가리키지만 routes/operatorRoutes.js 에 없음) — 본 라운드에서 Server 측 추가 필요 (별도 task) |

**경로 불일치 정정**: `iconia-admin-web/docs/api_contract.md` 가 `/api/admin/operator/...` 로 기록 → 실제는 `/api/v1/operator/...`. 본 라운드에 api_contract.md 정정도 포함.

---

## 3. 아키텍처

```
Browser                 iconia-admin-web (Next.js 14 App Router)        ICONIA-Server
─────────               ────────────────────────────────────────        ────────────────
                        ┌─ app/
                        │   login/page.tsx          (Server Component)  ┌─ POST /api/v1/operator/login
HTML form ─POST────►    │     ↳ <form action={loginAction}>             │  POST /api/v1/operator/login/mfa
                        │   login/mfa/page.tsx      (Server Component)  │  POST /api/v1/operator/logout
                        │     ↳ <form action={mfaAction}>               │  GET  /api/v1/operator/me  (NEW)
                        │   dashboard/page.tsx      (Server Component)  └────────────────────────────────
                        │     ↳ readSession → operatorMe → render
Set-Cookie ◄────────    ├─ lib/
                        │   serverApi.ts           ICONIA-Server 통신 단일 진입
                        │   authCookie.ts          쿠키 read/write/clear
                        │   actions/
                        │     login.ts             1단계 Server Action
                        │     mfa.ts               2단계 Server Action
                        │     logout.ts            로그아웃 Server Action
                        │   errorMessages.ts       서버 에러 코드 → 한국어 매핑
                        │   types.ts               OperatorRole, ServerResult, …
                        │   env.ts                 환경변수 1회 검증
                        └─ middleware.ts            /dashboard* 쿠키 부재 시 /login 으로 redirect
```

### 단위별 단일 책임

| 단위 | 책임 | 의존성 |
|---|---|---|
| `serverApi.ts` | ICONIA-Server fetch + 응답을 `ServerResult` 로 변환. 예외 던지지 않음. | `fetch`, `env.ICONIA_SERVER_URL` |
| `authCookie.ts` | 쿠키 이름/플래그/Max-Age 단일 소유. 다른 곳은 read/write/clear API 만. | `next/headers`, `env.COOKIE_SECURE` |
| `actions/login.ts` | Zod 검증 → serverApi → MFA 페이지 redirect 또는 쿠키 작성 + dashboard redirect 또는 에러 반환 | `serverApi`, `authCookie`, `next/navigation`, `zod` |
| `actions/mfa.ts` | TOTP 또는 recovery_code 분기 → serverApi → 쿠키 작성 + dashboard redirect | 위와 동일 |
| `actions/logout.ts` | 쿠키 읽기 → serverApi.logout → 쿠키 클리어 → /login redirect (best-effort) | 위와 동일 |
| `errorMessages.ts` | 코드 → 한국어 메시지 매핑 (단순 객체) | 없음 |
| `middleware.ts` | UX 가드. 쿠키 부재만 검사 (JWT 디코드 안 함) | `next/server` |
| 페이지 | 폼/헤더 렌더만. 비즈니스 로직 없음. | 액션 + UI 라이브러리 |

### 핵심 불변식

- JWT 는 Server Action / Server Component / `serverApi` 안에서만 메모리에 존재. 클라이언트 번들에 절대 포함되지 않는다.
- 쿠키 이름은 `authCookie.ts` 안에서만 등장. 페이지/액션은 read/write/clear API 만 호출.
- `serverApi` 는 예외 대신 `ServerResult` 를 반환. 액션은 `result.ok` 분기로 단일 처리.
- `middleware` 는 보안 경계가 아니라 UX 최적화. 진짜 보안 경계는 Server 가 매 요청 JWT 검증하는 지점.

---

## 4. 데이터 흐름 (3 가지 핵심 시나리오)

### 시나리오 A — 로그인 성공 (TOTP 정상)

1. 브라우저: `GET /login` → 폼 표시.
2. 브라우저: `POST /login` (form action=loginAction) → Next.js 가 `loginAction` 실행.
3. `loginAction`:
   - Zod 검증 (`email`, `password`).
   - `serverApi.operatorLoginStep1({email, password})` → 200 `{mfa_session_token, mfa_required: true}`.
   - `redirect('/login/mfa?token=<mfa_session_token>')`.
4. 브라우저: 303 따라가 `GET /login/mfa?token=...` → MFA 폼 표시.
5. 브라우저: `POST /login/mfa` (form action=mfaAction) → `mfaAction` 실행.
6. `mfaAction`:
   - FormData 에서 `mfa_session_token`, `mode`, `code` 추출.
   - `serverApi.operatorLoginStep2({mfa_session_token, totp})` → 200 `{jwt, expires_at, operator}`.
   - `authCookie.writeSession(jwt, expires_at)`.
   - `redirect('/dashboard')`.
7. 브라우저: 303 + Set-Cookie → `GET /dashboard`.
8. `middleware`: 쿠키 존재 ✓ → 통과.
9. `dashboard/page`: `readSession` → `serverApi.operatorMe(jwt)` → 200 → 헤더에 `operator.email (operator.role)` + 로그아웃 버튼 + 본문 placeholder 렌더.

### 시나리오 B — 로그아웃

1. 브라우저: 대시보드의 `<form action={logoutAction}>` 제출.
2. `logoutAction`:
   - `readSession` → `jwt`.
   - `serverApi.operatorLogout(jwt)` → 200 (혹은 실패해도 진행).
   - `clearSession`.
   - `redirect('/login')`.
3. 브라우저: 303 + Set-Cookie Max-Age=0 → `/login`.
4. 이후 `/dashboard` 직접 접근 시 미들웨어가 쿠키 부재 감지 → `/login` redirect.

### 시나리오 C — 만료된 세션으로 보호 화면 접근

1. 브라우저: `GET /dashboard` (오래된 쿠키 보유).
2. `middleware`: 쿠키 존재 ✓ (만료 여부 모름) → 통과.
3. `dashboard/page`: `serverApi.operatorMe(jwt)` → 401 `ERR_OPERATOR_AUTH_EXPIRED`.
4. `clearSession` + `redirect('/login?reason=expired')`.
5. `/login` 페이지가 `reason` 쿼리 읽어 "세션이 만료되었습니다." 표시.

### 핵심 타입 (`lib/types.ts`)

```ts
export type OperatorRole = "cs" | "sre" | "secops" | "superadmin";

export type OperatorPublic = {
  id: string;
  email: string;
  role: OperatorRole;
};

export type ServerResult<T> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; status: number; details?: unknown };

export type LoginStep1Response =
  | { mfa_session_token: string; mfa_required: true }
  | { jwt: string; expires_at: string; operator: OperatorPublic };

export type LoginStep2Response = {
  jwt: string;
  expires_at: string;
  operator: OperatorPublic;
};
```

### 환경 설정 (`lib/env.ts`)

| 변수 | 필수 | 용도 |
|---|---|---|
| `ICONIA_SERVER_URL` | ✓ | Server 베이스 URL (예: `https://api.iconia.example.com`) |
| `NODE_ENV` | (Next.js 자동) | `production` 시 `Cookie Secure=true` |

### 쿠키 정책 (`lib/authCookie.ts` 내부 상수)

| 속성 | 값 |
|---|---|
| name | `iconia_admin_session` |
| value | JWT (RS256) |
| httpOnly | true |
| Secure | `env.COOKIE_SECURE` (prod=true, dev=false) |
| SameSite | Strict |
| Path | `/` |
| Max-Age | `Math.floor((expiresAtMs - Date.now()) / 1000)` |

---

## 5. 에러 처리

### 코드 → 사용자 메시지 매핑 (`lib/errorMessages.ts`)

| 서버 코드 | 한국어 메시지 | 부가 동작 |
|---|---|---|
| `ERR_VALIDATION_LOCAL` | 입력값을 확인해주세요. | (클라이언트 측 Zod 실패) |
| `ERR_OPERATOR_INVALID_CREDENTIALS` | 이메일 또는 비밀번호가 올바르지 않습니다. | 이메일/비밀번호 어느 쪽이 틀렸는지 노출 금지 |
| `ERR_OPERATOR_SUSPENDED` | 계정이 정지되었습니다. 관리자에게 문의하세요. | — |
| `ERR_OPERATOR_MFA_INVALID` | 인증 코드가 올바르지 않습니다. | MFA 입력값만 비움, 토큰은 유지 |
| `ERR_OPERATOR_MFA_SESSION_EXPIRED` | MFA 세션이 만료되었습니다. 다시 로그인해주세요. | `/login?reason=mfa_expired` redirect |
| `ERR_OPERATOR_AUTH_EXPIRED` | 세션이 만료되었습니다. 다시 로그인해주세요. | clearSession + `/login?reason=expired` |
| `ERR_OPERATOR_AUTH_INVALID` | 유효하지 않은 세션입니다. | clearSession + `/login?reason=invalid` |
| `ERR_RATE_LIMITED` | 요청이 너무 많습니다. 잠시 후 다시 시도하세요. | (필요 시) Retry-After 표시 |
| `ERR_SERVER_UNAVAILABLE` | 일시적인 서버 오류입니다. 잠시 후 다시 시도하세요. | — |
| `ERR_NETWORK` | 네트워크 연결을 확인해주세요. | — |
| `ERR_INVALID_RESPONSE` | 서버 응답을 처리할 수 없습니다. | — |
| `__DEFAULT__` | 알 수 없는 오류가 발생했습니다. | (그 외 모든 코드) |

### 표시 규칙

- 에러는 모두 `useFormState` 의 `state.error` 로 폼 상단 표시. 토스트 사용 안 함.
- 페이지 이동을 동반하는 에러(만료 등)는 query string `?reason=...` 으로 메시지 키 전달.
- 비밀번호/JWT/recovery code 는 어떤 경우에도 로그/메시지에 포함 금지.

### 무한 리다이렉트 방지

- `middleware` 는 `/dashboard*` 경로만 검사. `/login*` 은 항상 통과.
- `dashboard/page` 가 만료된 쿠키 인지 시 `clearSession` 한 뒤 `/login` 으로 보내므로 다음 진입 시 미들웨어가 차단 → loop 없음.
- `/login` 페이지에서 이미 유효한 쿠키 보유 시 자동으로 `/dashboard` 로 보내는 동작은 본 라운드에 **포함하지 않음** (UX 최적화는 다음 라운드, 만에 하나의 loop 가능성 회피).

### 감사 로그

- admin-web 은 audit_log 추가 기록 안 함. ICONIA-Server 의 `operator_login`, `operator_login_failed`, `operator_login_mfa_success`, `operator_login_mfa_failed` 가 이미 모든 시도를 기록 (`Server/src/services/operatorService.js` 라인 301, 352, 391, 399, 519, 578 확인).

---

## 6. 테스트 전략 (TDD 진입)

### 피라미드

| 층 | 도구 | 대략 개수 | 범위 |
|---|---|---|---|
| 단위 | Vitest + jsdom | ~25 | serverApi(8), authCookie(4), errorMessages(2), 컴포넌트(8), middleware(3) |
| 통합 | Vitest | ~6 | 액션(login/mfa/logout) + 페이지(dashboard 진입) |
| E2E | Playwright | 1 | 전체 로그인 → 대시보드 → 로그아웃 시나리오 |

### Red-Green-Refactor 진행 순서

1. **`lib/serverApi.ts`** — 가장 안쪽, UI 의존성 없음. 200/4xx/5xx/네트워크/JSON 파싱 실패 모두 RED 부터.
2. **`lib/authCookie.ts`** — `next/headers` mock. write/read/clear, Secure 토글.
3. **`lib/errorMessages.ts`** — 매핑 + fallback.
4. **`test/helpers/runAction.ts`** — Server Action 테스트용 헬퍼. `redirect()` 와 `cookies().set/delete` 캡처. 본 헬퍼 자체를 먼저 TDD.
5. **`lib/actions/login.ts`** — Zod 검증, MFA redirect, 직접 JWT 발급, 각종 에러.
6. **`lib/actions/mfa.ts`** — TOTP/recovery 분기, 세션 만료.
7. **`lib/actions/logout.ts`** — 정상/Server 실패/쿠키 부재.
8. **`middleware.ts`** — 쿠키 부재/존재/login 경로 통과.
9. **컴포넌트 (RTL)** — `LoginForm`, `MfaForm` 렌더 + 토글 + 에러 표시 (액션은 mock).
10. **통합** — `dashboard/page` Server Component 의 `operatorMe` 호출 + 만료 처리.
11. **E2E (Playwright)** — `tests/e2e/auth.spec.ts`:
    - `/dashboard` 직접 접근 → `/login` redirect.
    - 잘못된 비밀번호 → 에러 표시.
    - 정상 로그인 → MFA → 대시보드 도달, 헤더에 email 표시.
    - 로그아웃 → `/login` 도달 + `/dashboard` 재접근 차단.

### 모킹 정책

- `serverApi` 는 단위/통합 테스트에서 항상 mock. E2E 만 실제 Server 연결.
- `next/headers`, `next/navigation` 은 Vitest setup 에서 글로벌 mock.
- 시간 의존(쿠키 Max-Age) 은 `vi.useFakeTimers()`.

### CI 게이트

- `npm test` (Vitest) — 단위 + 통합. 커버리지 ≥ 90% (`lib/`, `app/login/`, `app/dashboard/`).
- `npm run test:e2e` (Playwright) — 별도 job, 테스트용 ICONIA-Server fixture 필요.
- `npm run typecheck` — `tsc --noEmit`.
- `npm run lint` — `next lint`.

---

## 7. 보안 정책 (재확인)

| 위협 | 본 라운드 방어 |
|---|---|
| XSS → JWT 탈취 | httpOnly 쿠키. JWT 클라이언트 노출 0. |
| CSRF | SameSite=Strict (1차). 본 라운드의 mutating action 은 인증 흐름(login/MFA/logout) 으로 한정 — Strict 쿠키만으로 cross-site 자동 제출 차단됨. 일반 운영 mutating 화면 도입 시 이중 제출 토큰 추가는 다음 라운드. |
| 계정 열거 | 로그인 실패 메시지에 이메일/비밀번호 어느 쪽이 틀렸는지 노출 금지. |
| 무차별 시도 | Server 의 `loginRateLimiter` 가 1차. admin-web 은 429 표시. |
| MFA 우회 | 1단계 응답이 `mfa_required: true` 면 반드시 2단계 거침. 클라이언트 분기 신뢰 안 함 — Server 가 강제. |
| 민감 정보 로깅 | `serverApi` 가 입력값 재로그 금지. 에러 메시지에 password/JWT/recovery 코드 포함 금지. |
| 세션 고정 | Server 가 매 로그인마다 새 jti 발급. logout 시 family revoke (Server `operatorService.logout`). |

---

## 8. 본 라운드 산출물 체크리스트

**iconia-admin-web/**
- [ ] `package.json` (Next.js 14, React 18, TypeScript, Tailwind, shadcn/ui, Vitest, RTL, Playwright, zod)
- [ ] Next.js scaffold (`next.config.mjs`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.js`, `app/globals.css`, `app/layout.tsx`)
- [ ] `lib/types.ts`
- [ ] `lib/env.ts`
- [ ] `lib/serverApi.ts` + 단위 테스트
- [ ] `lib/authCookie.ts` + 단위 테스트
- [ ] `lib/errorMessages.ts` + 단위 테스트
- [ ] `lib/actions/login.ts` + 단위 테스트
- [ ] `lib/actions/mfa.ts` + 단위 테스트
- [ ] `lib/actions/logout.ts` + 단위 테스트
- [ ] `middleware.ts` + 단위 테스트
- [ ] `app/login/page.tsx` + `app/login/mfa/page.tsx`
- [ ] `app/dashboard/page.tsx` + `app/components/LogoutForm.tsx`
- [ ] `app/login/layout.tsx` + `app/dashboard/layout.tsx`
- [ ] `test/helpers/runAction.ts` + `test/helpers/mockServerApi.ts`
- [ ] `tests/e2e/auth.spec.ts`
- [ ] CI 설정 (`npm test`, `npm run test:e2e`, `npm run typecheck`, `npm run lint` 통과)
- [ ] README 갱신 (실제 실행 방법, 환경변수)
- [ ] `docs/api_contract.md` 경로 정정 (`/api/admin/operator` → `/api/v1/operator`, `/me` 추가 표기)

**ICONIA-Server/**
- [ ] `GET /api/v1/operator/me` 추가 (현재 미구현 — admin-web `dashboard/page` 가 의존). `requireOperator(["cs","sre","secops","superadmin"])` + `req.operator` 그대로 반환.

---

## 9. 다음 라운드 시 다룰 항목 (참고)

- CSRF 이중 제출 토큰 (mutating 화면 도입과 함께)
- Refresh token rotation UI (현재는 짧은 만료 + 재로그인)
- 운영 콘솔 본 화면 (Users/Devices/Firmware/Audit/Reports/SRE Dashboard)
- IP allowlist, Read-only Mode (CS role), 2-eye rule (SecOps)
- i18n 도입
- Sentry/CloudWatch 연동
