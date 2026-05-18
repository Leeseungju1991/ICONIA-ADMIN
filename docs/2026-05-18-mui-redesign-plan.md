# Implementation Plan — ICONIA Admin (`5. ADMIN/`) Material Dashboard React Re-skin

> Plan agent 산출 (2026-05-18). 사용자 승인 결정: **Primary = 블루 #1A73E8**, 실행 = 순차 1 에이전트.

## At-a-glance

- **변경**: `app/layout.tsx` (theme provider), `app/globals.css` (gut, ~30줄로), `app/dashboard/layout.tsx` (사이드바 + AppBar), 14 페이지 재스킨, 8 컴포넌트 MUI primitive로 교체. 신규 `app/(theme)/`, `app/components/dashboard/`.
- **변경 금지**: `lib/**` 전체, `middleware.ts`, `next.config.mjs`의 CSP/헤더, `audit/export/download/route.ts`, 모든 테스트 *의도*.
- **추가 스택**: MUI 5, emotion, Roboto + Noto Sans KR via `next/font/google`. chart.js는 보류 (서버 시계열 미노출).
- **비주얼**: light page bg `#f0f2f5`, dark-gradient sidebar `#42424a → #191919`, white cards w/ `xl/xxl` elevation, **primary 블루 `#1A73E8`**, card radius 12px.

---

## Phase 0 — Reference Analysis (완료, 본 문서에 반영됨)

Material Dashboard React 오픈소스 레포에서 직접 추출한 토큰:

**Color tokens** (`src/assets/theme/base/colors.js`):
- Primary `#e91e63` (데모 원본), Secondary `#7b809a`, Info `#1A73E8`, Success `#4CAF50`, Warning `#fb8c00`, Error `#F44335`, Dark `#344767`, Light `#f0f2f5`, Background `#f0f2f5`
- Gradient pairs (main → state):
  - Info `#49a3f1 → #1A73E8`, Success `#66BB6A → #43A047`, Warning `#FFA726 → #FB8C00`, Error `#EF5350 → #E53935`, Dark `#42424a → #191919`, Primary `#EC407A → #D81B60`

**Typography**: Roboto / Helvetica / Arial. Weights 300/400/600/700. H1 48 / H2 36 / H3 30 / H4 24 / H5 20 / H6 16; body sm 14 / md 16.

**Borders**: radius scale xs 1.6px, sm 2px, **md 6px**, lg 8px, **xl 12px**, xxl 16px. Cards `xl`(12px); buttons `md`(6px).

**Shadows**: xs/sm/md/lg/xl/**xxl**, `navbarBoxShadow`, `colored.*` 패밀리(stat-card 컬러 헤더).

**Sidenav**: width open 250px / mini 96px. Background gradient `#42424a → #191919`. boxShadow xxl, no border, fixed left.

**Charts**: `chart.js@4.3` + `react-chartjs-2@5.2`. 본 작업에서는 보류.

**재현할 시각 시그니처**:
1. 컬러 그라데이션 헤더(stat card 위로 튀어나온 elevated icon block, negative top-margin)
2. 다크 사이드바 + 흰 로고/브랜드, active 상태 둥근 흰 pill
3. 페이지 브레드크럼 + 페이지 타이틀(투명 AppBar)
4. 외곽 보더 없는 테이블, 행 사이만 디바이더, hover 매우 옅은 회색
5. Card radius 12px, shadow xl/xxl

---

## Phase 1 — Design Token / Theme

### 1.1 Palette decision

사용자 승인: **블루 #1A73E8** primary.

| Token | 데모 default | ICONIA |
|---|---|---|
| `primary.main` | `#e91e63` | **`#1A73E8`** |
| `primary.gradient` | `#EC407A → #D81B60` | `#49a3f1 → #1A73E8` |
| `info.main` | `#1A73E8` | `#4FC3F7` (cyan으로 강등) |
| `success.main` | `#4CAF50` | unchanged |
| `warning.main` | `#fb8c00` | unchanged |
| `error.main` | `#F44335` | unchanged |
| `secondary` | `#7b809a` | unchanged |
| `dark.gradient` | `#42424a → #191919` | unchanged (사이드바) |
| `background.default` | `#f0f2f5` | unchanged |
| Surface | `#ffffff` | unchanged |

EnvBadge: PROD→error, STG→warning, DEV→secondary.

### 1.2 Theme structure

단일 `createTheme()` from `app/(theme)/theme.ts`. **Light mode only.**

```ts
createTheme({
  palette: { mode: "light", primary: { main: "#1A73E8" }, /* ... */ },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily: "var(--font-roboto), var(--font-noto-sans-kr), -apple-system, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif",
    h1: { fontSize: "3rem", fontWeight: 700, lineHeight: 1.25 },
    /* h2..h6 + body */
  },
  components: {
    MuiCard: { styleOverrides: { root: { borderRadius: 12, boxShadow: "<<xl>>", overflow: "visible" } } },
    MuiAppBar: { defaultProps: { elevation: 0, color: "transparent" } },
    MuiTableCell: { styleOverrides: { root: { borderBottom: "1px solid #f0f2f5" } } },
    MuiButton: { defaultProps: { disableRipple: false }, styleOverrides: { root: { borderRadius: 6, textTransform: "none", fontWeight: 600, minHeight: 44 } } },
  },
})
```

stat-card의 컬러 그라데이션 아이콘 블록은 stock MUI 아님 → `app/components/dashboard/StatCard.tsx` 로컬 빌드.

### 1.3 Dark mode — Out of scope

### 1.4 한글 폰트

- `next/font/google` → CSP `font-src 'self'` 와 호환 (별도 수정 불필요)
- **Roboto** (300/400/500/700) + **Noto Sans KR** (400/500/700) — Pretendard는 Google Fonts에 없음
- Roboto만 preload, Noto Sans KR는 `display: "swap"`, `preload: false`

### Phase 1 산출물
- `app/(theme)/theme.ts` (new)
- `app/(theme)/fonts.ts` (new)

---

## Phase 2 — Infrastructure

### 2.1 Dependencies

```json
"@mui/material": "^5.16",
"@mui/icons-material": "^5.16",
"@mui/material-nextjs": "^5.16",
"@emotion/react": "^11.13",
"@emotion/styled": "^11.13",
"@emotion/cache": "^11.13"
```

MUI v6는 breaking change — v5 고정. chart.js는 보류.

### 2.2 Next 14 App Router + MUI SSR

공식 `@mui/material-nextjs/v14-appRouter` 의 `AppRouterCacheProvider` 사용. **커스텀 cache 금지** — hydration mismatch 위험.

```tsx
// app/layout.tsx sketch
import { AppRouterCacheProvider } from "@mui/material-nextjs/v14-appRouter";
import { ThemeProvider, CssBaseline } from "@mui/material";
import { theme } from "@/app/(theme)/theme";
import { roboto, notoSansKr } from "@/app/(theme)/fonts";
import "./globals.css";

export default function RootLayout({ children }) {
  return (
    <html lang="ko" className={`${roboto.variable} ${notoSansKr.variable}`}>
      <body>
        <AppRouterCacheProvider options={{ key: "mui" }}>
          <ThemeProvider theme={theme}>
            <CssBaseline />
            {children}
          </ThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
```

기존 `metadata` export 보존.

### 2.3 `globals.css` reduction

현재 251줄. 전략: **gut, don't delete**.

남길 것:
- `.spinner` keyframe (LoginForm/MfaForm pending 표시에서 사용)
- 마커 클래스: `kb-item-active` (knowledge/page.test.tsx 의존), `btn`/`btn small`/`btn full`/`btn danger`/`btn secondary` (DisabledActionButton.test.tsx 의존 — MUI Button이 className forward하므로 자동 통과 예상)
- body font-smoothing
- 전환용 CSS 변수 일부 (`--muted`, `--error-fg`)

제거: `.shell`, `.sidebar`, `.tile`, `table.list`, `.badge`, `.dashboard` 레거시 등

최종 ~30줄.

### Phase 2 산출물
- `package.json`, `package-lock.json` 갱신
- `app/layout.tsx` 재작성
- `app/globals.css` gut
- `app/(theme)/theme.ts`, `app/(theme)/fonts.ts`

---

## Phase 3 — Common Layout

### 3.1 In-flight diff 처리

`app/dashboard/layout.tsx`는 **이미 modified** (uncommitted). diff는 `invalid identity` 브랜치에서 `clearSession()` 제거. **재작성도 clearSession() 호출하지 않아야 함**.

`lib/actions/login.ts`도 modified — 본 작업은 lib/** 손대지 않음.

### 3.2 새 구조

```
app/components/dashboard/
  Sidebar.tsx
  SidebarNavItem.tsx
  AppBar.tsx
  Breadcrumbs.tsx
  navConfig.ts
  StatCard.tsx
  ChartCard.tsx  (옵션 — 차트 보류 시 미생성)
```

### 3.3 Sidebar

- MUI `Drawer` permanent (md+) / temporary (mobile)
- Width 250px, background gradient `#42424a → #191919`
- Brand row (로고 + "ICONIA Admin")
- Divider
- Nav items: `ListItemButton component={Link}`, 비활성 흰 80% opacity, 활성 흰 배경 + 블루 텍스트 + 8px rounded pill (usePathname → Client Component)
- Footer: identity email + role chip + LogoutButton

NAV 아이콘 매핑:

| 라벨 | Icon |
|---|---|
| 개요 | `DashboardOutlined` |
| 사용자 | `PeopleOutlined` |
| 디바이스 | `RouterOutlined` |
| 펌웨어 배포 | `MemoryOutlined` |
| AI 상태 | `MonitorHeartOutlined` |
| Knowledge Base | `MenuBookOutlined` |
| 게시물 모더레이션 | `ShieldOutlined` |
| Audit 로그 | `FactCheckOutlined` |
| 운영자 | `AdminPanelSettingsOutlined` |
| 상품 | `Inventory2Outlined` |
| 주문 | `ReceiptLongOutlined` |
| 웹훅 | `WebhookOutlined` |

Commerce 트리오 → `<ListSubheader>Commerce</ListSubheader>` 하위로. 기존 `—` 프리픽스 제거.

### 3.4 AppBar

- 투명 (`color="transparent"`, `elevation={0}`)
- 좌측: 브레드크럼 (usePathname 기반)
- 우측: EnvBadge Chip + LogoutButton (`IconButton + LogoutOutlined`)
- 검색/알림 없음 (out of scope)

### 3.5 dashboard/layout.tsx

```tsx
return (
  <Box sx={{ display: "flex", minHeight: "100vh" }}>
    <Sidebar visibleNav={visibleNav} identity={identity} />
    <Box component="main" sx={{ flexGrow: 1, ml: { md: "250px" }, p: 3, bgcolor: "background.default" }}>
      <DashboardAppBar identity={identity} />
      <Box sx={{ pt: 2 }}>{children}</Box>
    </Box>
    <IdleTimer timeoutMinutes={idleTimeoutMinutes} />
  </Box>
);
```

서버측 auth 체크 (`readSession`, `readIdentityFromJwt`, `roleAllowed`) **그대로 유지**.

### 3.6 추가 정리

`app/dashboard/users/[id]/page.tsx` 가 자체 `<header>` 와 `.dashboard` shell 사용 중 → 제거하고 dashboard layout 사용 (IMPLEMENTATION_BACKLOG §7.5 가 이미 플래그한 항목).

---

## Phase 4 — Page Re-skin (14 pages)

각 페이지: (a) 현 구조 / (b) MUI 매핑 / (c) 보존 항목

### 4.1 `/login`
- 중앙 정렬 Card 위에 info-gradient 히어로 배경. Width 400px, xl elevation.
- `searchParams.reason` → `<LoginForm reason>` 그대로.

### 4.2 `/login/mfa`
- 동일 패턴. `searchParams.token` 검증/리다이렉트 서버측 유지.

### 4.3 `/dashboard` 홈
- 4 컬럼 StatCard: AI fallback rate (error gradient) / AI p95 latency (warning) / 디바이스 API (success) / 디바이스 (info)
- 차트 **보류** (서버 시계열 미노출)
- 빠른 이동 + 환경 정보 Card 2개
- `safeAiHealth`, `safeDevicesCount`, `dynamic="force-dynamic"` 유지

### 4.4 `/dashboard/ai-health`
- 3 StatCard + "Error codes" Card 안 Table. 빈 상태 Alert info.

### 4.5 `/dashboard/audit`
- 필터 Card (TextField + native `datetime-local` — x-date-pickers 미도입)
- 메인 Table Card, 헤더 "감사 로그 (24h)"
- chain hash → Tooltip + Hash 아이콘
- OutcomeBadge → `Chip size="small" color={...}`
- 모든 searchParams + GET form action 유지

### 4.6 `/dashboard/audit/export`
- form action="/dashboard/audit/export/download" method="get" **mandatory**
- defaultIsoSince/Until 유지
- route.ts 미수정

### 4.7 `/dashboard/commerce/orders`
- 툴바 Stack + Card. syncOrdersAction 보존 (form action server action)
- StatusBadge → Chip with color map. Table → MUI Table.

### 4.8 `/dashboard/commerce/products`
- 같은 패턴. 썸네일 `Avatar variant="rounded"`. WP 외부 링크 `<OpenInNewOutlined>`.
- syncProductsAction, syncCategoriesAction 보존.

### 4.9 `/dashboard/commerce/webhooks`
- Checkbox `FormControlLabel`. processed → Chip success/error. only_failures 폼 컨트랙트 유지.

### 4.10 `/dashboard/devices`
- 필터 Card + TextField + Select. Status Chip (online=success / offline=warning / lost=error / unpaired,archived=secondary).
- listDevices params (q/status/limit:50) 유지.

### 4.11 `/dashboard/devices/[id]`
- 레거시 shell 제거. AppBar 브레드크럼 사용.
- 기본 정보 → List 또는 Table. OTA 이력 → Table.
- 운영 액션 → 2 Card. forceUnpairAction (`ConfirmActionForm`), markLostAction (raw form + hidden inputs).
- `<input type="hidden" name="device_id">` 그대로.

### 4.12 `/dashboard/firmware`
- Tabs("버전" / "배포") 권장. 각 탭은 Card + Table. Pagination MUI 컴포넌트 (`?vpage=N&dpage=M`).
- pauseDeploymentAction / resumeDeploymentAction, canMutate 가드 유지.

### 4.13 `/dashboard/knowledge`
- 3 패널 유지 (Sources/Chunks/Query). 각 Card + CardHeader.
- **SourcesPanel 활성 버튼은 `kb-item-active` 클래스 유지** (테스트 의존).
- ChunksPanel ListItem + monospaced pre.
- QueryPanel TextField multiline + Select + Button. 인용 `<details>` → Accordion.
- listRagSources, getChunksAction, testQueryAction, useState/useTransition/useEffect 패턴 유지.

### 4.14 `/dashboard/operators`
- Card + Table. Status → Chip. Self-disable 가드 + `data-testid="self-disable-blocked"` 유지.
- disableOperatorAction (`ConfirmActionForm`).

### 4.15 `/dashboard/posts`
- Card + Table. Excerpt 2줄 truncate. reported_count > 0 빨간색 강조.
- hidePostAction / unhidePostAction 보존, searchParams.filter 옵션 유지.

### 4.16 `/dashboard/users`
- 검색 Card (TextField fullWidth autoFocus + 검색 Button startIcon).
- 결과 Table Card + CardHeader subheader (페이지/보기 인디케이터).
- MUI Pagination (`renderItem` w/ next/link).
- 빈 상태 Alert info. searchUsers, clearSession + redirect 서버측 유지.

### 4.17 `/dashboard/users/[id]`
- 레거시 shell 제거.
- 헤더: Avatar(이메일 첫자) + Typography h4 + Chip(account_status).
- key-value → List `ListItemText primary/secondary`.
- 운영 액션 Card + ForceLogoutButton.
- 에러 상태 → Alert error + 목록 복귀 Button.
- getUserDetail, clearSession redirect, `ForceLogoutButton userId={user.id}` 그대로.

---

## Phase 5 — Component Re-skin (8개)

### 5.1 EnvBadge (server)
`<Chip>` PROD=error filled / STG=warning filled / DEV=default outlined. `data-testid="env-badge"` + role/aria 유지.

### 5.2 LoginForm (client)
- `<form action={action}>` 외곽 유지.
- TextField `label="아이디"` / `label="비밀번호"`. `aria-invalid`, `error/helperText`.
- action-level 에러는 `<Alert role="alert" id="login-form-error" severity="error">` 상단 배너로 유지 (테스트 `findByRole("alert")` 호환).
- Submit MUI Button `disabled={pending} aria-busy={pending}`. Pending 시 `.spinner` 클래스 사용 (globals.css keyframe).
- 테스트 변경 0 예상.

### 5.3 MfaForm (client)
- `<form action={action} noValidate>` 외곽 유지.
- **Hidden `token`/`mode` input은 raw `<input type="hidden">` 유지** — 테스트 `container.querySelector('input[name="token"]')` 의존.
- code TextField `inputProps` (`inputMode`, `pattern`, `maxLength`, `autoComplete="one-time-code"`).
- 토글 버튼 MUI outlined.
- 테스트 변경 0 예상.

### 5.4 ConfirmActionForm (client)
- `<button>` → MUI Button (variant/color from buttonClassName).
- **`window.confirm`/`window.prompt`/`window.alert` 유지** — 테스트가 stub함. MUI Dialog로 바꾸지 않음.
- useTransition + startTransition 유지.

### 5.5 DisabledActionButton (server)
- MUI Button `disabled aria-disabled="true"` + 모든 prop 전달.
- `toHaveClass("btn", "small", "foo")` — MUI가 className forward하므로 통과.

### 5.6 ForceLogoutButton — 변경 없음 (ConfirmActionForm 통한 재스킨)

### 5.7 LogoutButton — AppBar 안 아이콘 버전:
```tsx
<form action={logoutAction}>
  <IconButton type="submit" color="inherit" aria-label="로그아웃" title="로그아웃">
    <LogoutOutlined />
  </IconButton>
</form>
```

### 5.8 IdleTimer (client)
- MUI Dialog. `data-testid="idle-warning"` — Dialog PaperProps 또는 내부 marker div.
- `data-testid="idle-countdown"`, `data-testid="idle-continue"` 보존.
- 로그아웃 버튼 내부 `<form action={idleLogoutAction}>` 보존.

---

## Phase 6 — Verification

```bash
npm install
npm run typecheck      # tsc --noEmit
npm run lint           # next lint
npm run test           # vitest run
npm run dev            # manual smoke
npm run build          # standalone
```

**테스트 위험도 순위**:
| 테스트 | 위험도 | 예상 대응 |
|---|---|---|
| `IdleTimer.test.tsx` | medium | `data-testid` 위치 검증, 필요 시 marker `<div>` 래핑 |
| `knowledge/page.test.tsx` | low | `kb-item-active` 클래스 유지 |
| `DisabledActionButton.test.tsx` | very low | className forward로 통과 예상 |
| `LoginForm.test.tsx` | very low | `getByLabelText`/`findByRole("alert")` MUI 호환 |
| `MfaForm.test.tsx` | very low | hidden input raw 유지 |
| `ConfirmActionForm.test.tsx` | very low | window dialog stub 유지 |
| `ForceLogoutButton.test.tsx` | very low | 위와 동일 |
| `audit/export/download/route.test.ts` | zero | UI 무관 |

**수동 스모크** (dev 서버):
- /login (+ reason=expired), /login/mfa (TOTP↔recovery 토글)
- /dashboard 4 stat card + 사이드바 + 환경/빠른이동 카드
- 사이드바 active 상태 / 네비게이션
- EnvBadge color, LogoutButton 작동
- 각 14 페이지 렌더 + CSP 위반 없음 + hydration 경고 없음
- 한글이 Noto Sans KR로 렌더
- audit/export CSV 다운로드
- force unpair / mark lost / disable operator / hide post 서버 액션
- knowledge 3 패널 인터랙션
- 모바일 (<900px) 사이드바 drawer 토글

---

## Phase 7 — Risks

### 7.1 정보 밀도
MUI 기본 elevation/padding은 행 밀도를 30% 감소시킴. 대응:
- 모든 데이터 테이블 `<Table size="small">` (32px 행)
- `<Card sx={{ p: 0 }}>` for table cards (패딩 중복 방지)
- `<TableCell sx={{ py: 1, px: 1.5 }}>`
- audit 테이블은 필요 시 `<TableContainer>` 수평 스크롤

### 7.2 한글 폰트
Noto Sans KR: ~600KB woff2 subsets, 운영자만 접근이므로 `display:"swap"` + `preload:false` 허용.

### 7.3 차트 보류
서버가 시계열 노출하면 다음 PR에서 dynamic import boundary로 추가.

### 7.4 Tailwind 미도입
사용자 결정: MUI + emotion only.

### 7.5 CSP 호환
- emotion inline style → `style-src 'unsafe-inline'` 매치
- `next/font/google` self-host → `font-src 'self'` 매치
- MUI 외부 리소스 0
- **CSP 변경 불필요**

### 7.6 SSR
공식 `AppRouterCacheProvider` 사용. 커스텀 `_document` 금지 (App Router 아님).

### 7.7 In-flight diff
`app/dashboard/layout.tsx` 작업 사본 의도 반영 (clearSession 미호출).

### 7.8 users/[id] legacy shell
제거하여 dashboard layout 사용.

### 7.9 Server Action 보존
모든 `<form action={serverAction}>` 가 진짜 `<form>` 으로 유지. MUI Button은 `type="submit"` 으로 form 내부에 배치.

### 7.10 시퀀싱
1 → 2 → 5 (컴포넌트 먼저, 페이지 소비자) → 3 (레이아웃) → 4 (페이지) → 6

---

## Critical Files

- `C:\Users\user\Music\ICONIA\5. ADMIN\app\layout.tsx`
- `C:\Users\user\Music\ICONIA\5. ADMIN\app\dashboard\layout.tsx`
- `C:\Users\user\Music\ICONIA\5. ADMIN\app\globals.css`
- `C:\Users\user\Music\ICONIA\5. ADMIN\next.config.mjs`
- `C:\Users\user\Music\ICONIA\5. ADMIN\package.json`
