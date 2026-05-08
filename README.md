# ICONIA Admin Console (`iconia-admin-web`)

**단일 운영자(Owner) 전용** 운영 콘솔. ICONIA-Server 의 `/api/v1/operator/*`
라우트를 인간 친화적 UI 로 노출.

> RBAC (cs/sre/secops/superadmin) 는 사용하지 않음. 본 web 은 role 을 표시
> 하지도, 분기하지도 않습니다. Server 가 설령 role 을 응답해도 무시.

- Repo: <https://github.com/Leeseungju1991/ICONIA-ADMIN>
- 패키지명 (`package.json`): `iconia-admin-web`

## 본 라운드 상태 (H-15 round 1 — Login + MFA + Logout)

`docs/2026-05-08-login-design.md` 디자인 스펙에 따른 인증 핵심 구현. TDD 로
작성됨 (56 단위/통합 테스트 통과).

**구현된 화면**

- `/login` — email + password → MFA 페이지 redirect 또는 직접 dashboard.
- `/login/mfa?token=…` — TOTP 6자리 또는 복구 코드 입력 → JWT 발급 + dashboard.
- `/dashboard` — 보호된 placeholder (헤더에 email + 로그아웃 버튼).
- 로그아웃 — Server 측 jti revoke (best-effort) + httpOnly 쿠키 삭제 + `/login` redirect.

**다음 라운드** — Users, Devices, Firmware, Reports, Audit, SRE Dashboard 화면.

## 개발 실행

```bash
# 환경변수
cp .env.example .env.local      # ICONIA_SERVER_URL 만 설정

npm install
npm run dev                      # http://localhost:3000
```

## 검증

```bash
npm test          # vitest run — 52 tests 통과
npm run typecheck # tsc --noEmit
npm run lint      # next lint
npm run build     # 본 라운드 build 그린
```

## 구조

```
iconia-admin-web/
├── app/
│   ├── layout.tsx              루트 레이아웃 + globals.css
│   ├── page.tsx                / → /login redirect
│   ├── login/
│   │   ├── page.tsx            로그인 폼 (Server Component)
│   │   └── mfa/page.tsx        MFA 폼 (Server Component)
│   ├── dashboard/page.tsx      placeholder + 로그아웃 버튼
│   └── components/
│       ├── LoginForm.tsx       Client (useFormState)
│       ├── MfaForm.tsx         Client (TOTP/recovery 토글)
│       └── LogoutButton.tsx    Server form action
├── lib/
│   ├── env.ts                  환경변수 검증
│   ├── types.ts                도메인 타입
│   ├── serverApi.ts            ICONIA-Server fetch (예외 던지지 않음)
│   ├── authCookie.ts           쿠키 단일 소유 (httpOnly + Strict)
│   ├── errorMessages.ts        서버 코드 → 한국어 메시지
│   ├── jwt.ts                  display-only payload decode (서명 검증 없음)
│   ├── identity.ts             JWT payload → { email } (단일 사용자, role 무시)
│   └── actions/
│       ├── login.ts            "use server"
│       ├── mfa.ts              "use server"
│       └── logout.ts           "use server"
├── middleware.ts               /dashboard* 쿠키 부재 → /login redirect
├── test/
│   ├── setup.ts                @testing-library/jest-dom
│   └── helpers/
│       └── captureRedirect.ts  next/navigation redirect() 캡처
├── next.config.mjs             보안 헤더 (X-Frame-Options 등)
└── vitest.config.ts            jsdom + react plugin
```

## 보안 정책

- JWT 는 httpOnly + Secure(prod) + SameSite=Strict 쿠키. 클라이언트 JS 로
  접근 불가.
- `lib/jwt.ts` 의 unsafe payload decode 는 **표시용 한정**. 실제 권한 결정은
  ICONIA-Server 가 매 요청 JWT 검증.
- Server 가 모든 인증 시도를 audit_log 기록 (operator_login_*).
- 로그인 실패 메시지에 이메일/비밀번호 어느 쪽이 틀렸는지 노출 금지.

## 본 라운드 비포함 (의도적)

- Tailwind / shadcn (디자인 스펙은 향후 라운드 — 현재 minimal CSS).
- Playwright E2E (실제 Server fixture 필요 — 별 라운드).
- CSRF 이중 제출 토큰 (mutating 화면 도입 시 추가, 현재는 `SameSite=Strict` 1차 방어).
- `/me` 호출 (Server 측 미구현, payload decode 로 대체).
- Refresh token rotation, IP allowlist, 2-eye rule.
- i18n (한국어 하드코딩).

## 환경변수

| 변수 | 필수 | 용도 |
|---|---|---|
| `ICONIA_SERVER_URL` | ✓ | Server 베이스 URL (예: `https://api.iconia.example.com`) |
| `NODE_ENV` | (Next.js 자동) | `production` 시 쿠키 `Secure=true` |
