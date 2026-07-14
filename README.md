# ICONIA ADMIN (운영자 콘솔)

> **Release Stage — MVP 1.0.0**  ·  제작자 / Author — **LEE SEUNG JU**

ICONIA 운영자 콘솔 — Next.js 14 (App Router) · React 18 · Tailwind 3.

> **★ 데이터 연결은 AWS 실서버 단일 대상입니다.**
> 기본 Server URL = `http://iconia-prod-alb-1600486872.ap-northeast-2.elb.amazonaws.com`.
> 도메인/HTTPS 가 준비되면 `ICONIA_SERVER_URL` env 로만 override 합니다 (env override 우선). 로컬/LAN 백엔드 연결 개념은 제거되었습니다.

---

## 1. 구조도

```
운영자 브라우저
    │  (HTTPS, httpOnly 쿠키)
    ▼
┌─────────────── ICONIA-ADMIN (Next.js 14) ───────────────┐
│  /login → MFA(TOTP) → JWT 발급                          │
│                                                          │
│  middleware.ts (Edge)                                    │
│     │ JWT 없음 → /login                                  │
│     │ role 기반 경로 차단                                 │
│     ▼                                                    │
│  /dashboard                                              │
│   ├─ 홈 (KPI 8종 + 5개 서비스 상태)                       │
│   ├─ CS 통합 조회·회원·디바이스·OTA·페르소나              │
│   ├─ 리뷰·신고·공지·푸시·통계                            │
│   ├─ 펌웨어/서버/앱 에러                                  │
│   ├─ 운영 안정성 9항목 + AI 호출 모니터링                 │
│   ├─ 운영 — SLO·알람·로그·감사·runbook (V1.0)             │
│   ├─ 양산·AS·운영 리포트 아카이브                         │
│   └─ 운영자 관리 (최고관리자)                             │
│                                                          │
│  Server Action / RSC (브라우저는 Server 직접 호출 안 함)  │
└──────────────────────┬───────────────────────────────────┘
                       │  Bearer JWT (서버사이드만)
                       ▼
                 ICONIA-SERVER
                  /api/v1/admin/*
                  /api/v1/operator/*
```

---

## 2. 동작 설명 (5줄)

1. 관리자가 ID/비밀번호와 2단계 인증(TOTP)으로 로그인합니다.
2. 한 화면에서 사용자·디바이스·AI 페르소나·펌웨어 배포·신고·공지·푸시를 관리합니다.
3. 시스템 건강 상태(서버·AI·DB·앱·관리자 콘솔)와 에러 발생을 실시간으로 지켜봅니다.
4. 문제가 생기면 즉시 복구 액션(강제 로그아웃·OTA 롤백·기능 차단)을 실행합니다.
5. 모든 강력한 조치는 사유 입력과 2단계 확인을 거쳐 감사 로그에 영구 기록됩니다.

---

## 3. 기능

> **Contract Matrix:** ADMIN ↔ SERVER endpoint 정합 매트릭스는 [`docs/contract-matrix.md`](docs/contract-matrix.md). 전체 정본은 `ICONIA-SERVER/docs/contract-matrix.md`. 정본 정책: **SERVER 가 single source of truth — ADMIN 은 SERVER spec 에 맞춤.** 회귀 가드는 `lib/adminApi.contractAlignment.test.ts` 가 담당.

### 3.1 데이터 연결 (AWS 실서버 단일)
- Admin 웹은 **오직 AWS 실서버(ICONIA-SERVER)** 에만 연결합니다 — 로컬/LAN 백엔드 연결 개념 없음
- 기본 Server URL = `http://iconia-prod-alb-1600486872.ap-northeast-2.elb.amazonaws.com`
- 운영 도메인/HTTPS 준비 시 `ICONIA_SERVER_URL` env 로 override (env override 우선)

### 3.2 로그인 / 권한
- ID + 비밀번호 + TOTP 2단계 인증
- 5단계 운영자 역할 (최고관리자 · SRE · 보안운영 · 고객지원 · 읽기전용)
- 역할별 메뉴 자동 필터링 (접근 불가 메뉴는 숨김)
- 30분 비활동 시 자동 로그아웃
- **운영자 IP 허용목록** — 운영자 IP 화이트리스트 관리 화면

### 3.3 대시보드 홈
- 8개 핵심 지표 카드 (활성 디바이스 · 일일 대화량 · 에러율 · 큐 적체 등)
- **5개 서비스 상태** — 백엔드(서버·AI·DB)와 클라이언트(관리자·앱)를 구간 분리해 표시
- 처리 대기 신고·앱 에러·서버 에러 미리보기 3건씩

### 3.4 회원 관리
- 이메일·이름·UUID 통합 검색
- 강제 로그아웃 · 계정 일시정지 · MFA 초기화 · 탈퇴 처리
- 개인정보(이메일·이름·전화) 기본 마스킹, 해제 시 감사 로그 자동 기록
- PIPA(개인정보보호법) 사용자 권리 추적 (열람·정정·삭제·이관)
- **사용자 수동 추가** (`/dashboard/users/new`) — 운영팀이 사용자를 대신해 가입 진행.
  비밀번호 강도 표시 · 약관 4종 대리 동의 · 19세 이상 본인 확인 · 사유 5자 이상 강제.
  확정 2단계 모달 + 감사 로그. Server `/api/v1/admin/users` (POST).

### 3.4b 사용자 360 통합 관리 (신규)
- 이메일·시리얼·UUID 한 줄 검색으로 한 사용자의 HW · Server · AI · APP 상태를 한 화면에서 관리
- HW: 페어링 디바이스별 OTA 채널 강제 / force-unpair / AS 티켓
- Server: 강제 로그아웃 / 계정 일시정지 / MFA 초기화
- AI: persona fallback 강제 토글 / persona 리셋
- APP: 테스트 푸시 / 강제 재인증
- 이벤트 타임라인 (audit + ops events 시간 역순)
- 모든 강력 액션 = 사유 5자+ + EXECUTE 2단계 + audit chain

### 3.5 디바이스 모니터링
- 인형(ESP32) 마지막 연결 시각·배터리·펌웨어 버전·온라인 여부
- 펌웨어 에러 발생 디바이스 추적
- 디바이스 소유권 이력 (페어링/해제/분실 신고)
- **Fleet 출하 잠금** — Secure Boot·Flash Encryption·JTAG 비활성 등 보안 invariant 위반 디바이스 감지

### 3.6 OTA(펌웨어) 배포
- 펌웨어 채널 관리 (stable/beta/dev)
- 단계적 배포 · 일시정지 · 중단 · 롤백
- 배포 실패 디바이스 코드별 분포

### 3.7 AI 페르소나
- SOUL 파일 24종 검수
- 스테이징 → 라이브 전환 → 롤백 (최고관리자 전용)
- 페르소나별 응답 품질 · 폴백 비율 · 평균 지연 추적

### 3.8 콘텐츠 운영
- **리뷰·신고 관리** — 게시물 신고 검토, 숨김·복구 처리 (감사 로그 자동)
- **피드 관리** — 사용자 피드 게시물 검색·숨김·복구·삭제 + 댓글 미리보기 (`/dashboard/feed`).
  Server `/api/v1/admin/feed/posts*` 정본. 삭제는 soft delete + DELETE 확인 문구.
- **피드 게시물 수동 작성** (`/dashboard/feed/new`) — 운영팀이 직접 피드 게시물을
  발행. 본문 4000자 · 미디어 drag-drop 업로드 (이미지 ≤ 5 MB · 비디오 ≤ 50 MB,
  최대 10개) · 상태 published/draft/hidden · 사유 5자 이상. 미디어는 사전에
  `/api/admin/media/upload` 프록시 (브라우저 XHR 진행률 표시) → Server
  `/api/v1/admin/media/upload` 로 forward, 발행은 Server `/api/v1/admin/feed/posts` (POST).
- **공지·배너 관리** — 앱/웹 공지사항 등록·수정·노출 일정
- **푸시 알림** — 전체/세그먼트 캠페인 발송 · 도달율 추적
- **운영 리포트 아카이브** — 매일 02:00 / 일요일 02:30 KST 자동 생성 리포트 조회 (수동 트리거는 최고관리자만)
- **피드 타임라인 + 인스펙터 (신규)** — 최신·인기·신고됨 탭 + 게시물 상세 (본문/미디어/댓글/신고 이력) + hide / unhide / takedown / 작성자 일괄 숨김

### 3.8b 커머스 운영 (출시 정비 — (주)숨코리아)
- **상품 관리** (`/dashboard/commerce/products`) — 상품 등록·수정·삭제·재고 관리.
  검색(상품명) / 카테고리 / 품절 필터. 모든 변경은 Server audit_log + soft delete.
  Server `/api/v1/admin/commerce/products*` 정본.
- **주문 관리** (`/dashboard/commerce/orders`) — 주문 상태 흐름 (결제대기 → 결제완료 →
  배송중 → 완료/취소) 관리. 결제수단·카드 정보는 admin 응답에서 의도적으로 제외
  (PIPA 최소수집). 상태 변경은 사유 5자 이상 + Server audit_log.
  Server `/api/v1/admin/commerce/orders*` 정본.

### 3.8c 운영 도구 — Seed
- **Seed 상태 / 수동 실행** (`/dashboard/ops/seed`) — 출시 직전 데모 데이터 충전.
  Server `/api/v1/admin/seed/{status,run}` 정본. 매 실행은 SEED 확인 문구 +
  사유 5자 이상 + audit_log 영구 기록. 카테고리별 카운트 + 마지막 실행 시각·실행자·소요시간 표시.

### 3.8a 법률/약관 관리 (출시 정비 — (주)숨코리아)
- **활성 약관 버전 조회** — terms / privacy / marketing / third_party 4종의 운영 정본
  버전을 Server `/api/v1/users/consent/active` 정본으로 표시. 사용자가 보는 값과 동일.
- **약관 본문 미리보기** — 운영자가 실제 사용자에게 노출되는 본문을 한국어/영어 토글로
  확인 (`/dashboard/legal`). 다국어 placeholder 본문 제공, 출시 전 법무 검토 본문으로 교체.
- **이전 버전 / 발행 이력** — 활성 + staging + 폐기 모든 버전 한 화면 조회.
  운영자가 회귀 비교용으로 참고.
- **신규 버전 발행 (superadmin)** — 약관 종류 / 버전 / 본문 / 변경 사유 / 즉시 활성 여부
  입력 폼. 발행 즉시 활성화 옵션 또는 staging 보관. 변경 사유는 감사 로그에 기록.
- **약관 변경 안내 공지 결합** — 신규 버전 발행 시 `/dashboard/notices` 공지 작성으로
  사용자에게 reconsent 안내 (UI 흐름은 운영팀이 manual 연결).
- **동의 통계 KPI** — `/dashboard` 홈에 활성 버전 + 마케팅 동의율 + 제3자 제공
  동의율 + 동의 이벤트 30일 카운트 카드. `/dashboard/legal` 에 약관 버전별 동의/거부.
- **사용자 권리 요청 큐** (`/dashboard/users/rights`) — PIPA 제35조(열람) /
  제36조(정정·삭제) / 제37조(이관) 요청을 상태(접수·검토·완료·거부) 와 종류로 필터.
  CS_OR_ABOVE 접근. 전이 액션은 사유 5자 + 감사 로그.
- **(주)숨코리아 사업자 정보** — 모든 운영자가 좌측 사이드바 footer 에서 1줄 확인.
  상세는 `/dashboard/legal` 의 회사 정보 패널 — 상호·대표·사업자등록번호·통신판매업
  신고·주소·고객지원/개인정보보호책임자 표시.

### 3.9 에러 로그
- 펌웨어/서버/앱 에러 통합 조회
- 코드별 분포 · 영향 사용자 수 · CSV/JSON 내보내기

### 3.10 운영 안정성 (9항목 통합)
- 관측 · 추적 · 알람 · 감사 · 재처리 · 복구 액션 · 강제 재시도 · 기능 차단 스위치 · 기능 플래그
- **AI 호출 모니터링** — Gemini 키 풀 상태, 컨텍스트 압축 발동률, Provider 분포 (실시간)

### 3.10a V1.0 관측성 / SLO / 알람 / 로그 (출시 정비)
- **SLO 대시보드** (`/dashboard/ops/slo`) — 전체 API 와 라우트별 p50/p95/p99 ·
  5xx/4xx 비율 · AI fallback · DB / 외부 의존성 상태. 5분 sliding window.
  Server `/api/v1/admin/metrics/slo` 정본 — 미배포 시 graceful "—" / "준비 중".
- **알람 설정** (`/dashboard/ops/alerts`) — SLO 위반 임계치 · 활성화 토글 · 채널
  (이메일/슬랙/webhook) 다중 선택. 변경은 사유 5자 + Server audit_log.
  Server `/api/v1/admin/alerts/config` (GET) + `/:key` (PATCH) 정본.
- **로그 검색** (`/dashboard/ops/logs`) — request-id / user-id / endpoint / status /
  level / 시간 범위 / 자유텍스트. PII 는 server 가 마스킹. 우측 드로어에 raw payload.
  Server `/api/v1/admin/logs/search` 정본.
- **감사 로그 뷰어** (`/dashboard/ops/audit`) — action / 운영자 / 대상 type / 시간
  필터. hash chain (`prev_hash` / `current_hash`) 노출. CSV export 1버튼.
  Server `/api/v1/admin/audit-log` 정본 (secops/sre/superadmin).
- **장애 대응 runbook** (`/dashboard/ops/runbook`) — 알람 종류별 (#anchor deep link)
  증상 / 대응 절차 / 관련 페이지 점프. + **수동 운영 작업** 인터페이스 —
  circuit breaker 강제 close · 캐시 invalidate · 메인터넌스 모드 토글 (사유 5자 +
  EXECUTE 2단계 확인). Server 미배포 시 graceful "준비 중".
- **Error Boundary** — `app/error.tsx` 가 페이지 단위 렌더 실패를 잡고,
  `app/global-error.tsx` 가 layout 자체 실패를 잡는다. 둘 다 빈 화면 대신
  사용자 메시지 + 다시 시도 / 대시보드 / runbook 점프 버튼을 표시.

### 3.11 양산 / 출고
- 양산 LOT 생성 · 시리얼 일괄 발급
- 공장 출고 검수 결과 조회
- AS(After-Sales) 교환 티켓 처리

### 3.12 통계
- DAU · 가입 · 매출 추세
- 사용자 인지 에러율 SLO 카드

### 3.13 운영자 관리 (최고관리자 전용)
- **운영자 초대** — 이메일 초대 + 역할 부여 + 초기 비밀번호 발급
- 운영자 비활성화 · 역할 변경
- 본인 계정 비활성화 차단 (self-disable 가드)
- TOTP 백업 코드 10개 발급 (CSV 다운로드)

### 3.14 양산화 / 안정성
- **대량 데이터** — 공통 DataTable 의 클라이언트 페이지네이션 + **서버 측 커서 페이지네이션** 옵션
- **API 안정성** — 모든 Server 호출 단일 경유, 10초 timeout, 5xx/네트워크 graceful 매핑 (절대 throw 안 함)
- **실시간 스트림** — 일부 모니터링 패널은 SSE(Server-Sent Events) 로 실시간 갱신
- **재시도** — transient 실패는 silent retry 3회 (사용자에겐 최종 실패만 노출)
- **2인 승인(2-eye)** — 중요 mutation 액션에 2명 운영자 승인 요구 헬퍼

### 3.15 보안
- httpOnly · SameSite=Strict 쿠키
- CSP · HSTS(운영) · X-Frame-Options · COOP/CORP 보안 헤더
- **Refresh token silent rotation** — 만료 5분 전 자동 갱신, 운영자 무인지
- 강력 액션 사유 5자 + EXECUTE 2단계 확인
- 모든 액션 감사 로그 (Server canonical hash chain + 세션 trail)

### 3.16 국제화
- 한국어 / 영어 메시지 분리 (`lib/i18n/messages-ko.ts`, `messages-en.ts`)
- 운영자 환경설정에서 언어 토글 (`admin_locale` 쿠키 + `ADMIN_DEFAULT_LOCALE` env)

### 3.17 디자인 시스템
- Tailwind 3 + 일관된 디자인 토큰 (색상·간격·타이포)
- 공통 컴포넌트 (PanelCard · StatCard · DataTable · 모달)

### 3.18 신규 페이지 · SERVER endpoint 의존성 (출시 정비)

운영팀 수동 진입 페이지 ↔ SERVER endpoint 매트릭스.

| 운영자 페이지 | 액션 | SERVER endpoint | Body 핵심 필드 |
| --- | --- | --- | --- |
| `/dashboard/users/new` | 사용자 추가 | `POST /api/v1/admin/users` | `email`, `password`, `agreedTermsVersion`, `ageVerified`, `autoVerified`, `reason` |
| `/dashboard/feed/new` | 게시물 발행 | `POST /api/v1/admin/feed/posts` | `authorId`, `body`, `media[]`, `status`, `reason` |
| `/dashboard/feed/new` (drag-drop) | 미디어 업로드 | `POST /api/v1/admin/media/upload` (multipart) | `file` (이미지 ≤ 5 MB · 비디오 ≤ 50 MB) |

- SERVER 미배포 시 ADMIN 폼은 정상 렌더하며 5xx/네트워크 오류는 "준비 중" 토스트로
  graceful 표시. 입력값은 보존된다.
- ADMIN 측 미디어 업로드는 `/api/admin/media/upload` Next.js Route Handler 가 인증을
  처리하고 SERVER 로 multipart 본문을 forward — 브라우저 XHR 가 진행률을 직접 노출.

### 3.19 자동 새로고침 (polling) — 페이지 매트릭스

운영자가 APP → SERVER → ADMIN 흐름을 즉시 확인할 수 있도록, 자주 갱신되는 페이지
3종에 토글 ON/OFF 식 polling 을 제공한다. 공통 hook 은 `lib/hooks/useAutoRefresh.ts`.

| 페이지 | 자동 갱신 | 주기 | 신규 행 표시 |
| --- | --- | --- | --- |
| `/dashboard/users` (실시간 사용자 패널) | ✅ | 10s | NEW 행 1초 highlight |
| `/dashboard/feed` | ✅ | 10s | NEW 칩 + ID highlight 1초 |
| `/dashboard/content/commerce` (상품) | ✅ | 10s | NEW 칩 + 행 highlight 1초 |

공통 동작:
- 기본 OFF (운영자 명시적 활성). 토글 클릭 시 즉시 polling 시작.
- 페이지 포커스 잃으면 자동 일시정지 (`document.visibilitychange`) — 배터리/CPU 절약.
- 포커스 복귀 시 즉시 1회 갱신 + interval 재개. "마지막 조회 HH:MM:SS" 표시.
- 갱신 중 SERVER 5xx → "일시 연결 끊김 — 다음 갱신에서 재시도" 토스트, interval 유지.
- 3회 연속 실패 → "자동 갱신 중지" 토스트 + 토글 자동 OFF (운영자 재활성화 필요).
- `prefers-reduced-motion` 환경에서는 highlight 애니메이션 비활성.

---

## 4. 추가 개발 항목

### ⚠️ 부분 가능 (이유)

- **mock → real swap 일부 화면** — Server endpoint 부재 항목은 client 함수 시그니처와 빈/에러 분기까지만 준비됨. Server `/api/v1/admin/ops/probes·alerts·traces·dead-letters·kill-switches·feature-flags·error-slo·expo-receipts·battery-distribution·users/signups·pipa/*·devices/pairings` 도입 후 swap 완료 가능. *(Server 라우트 작업이 선행되어야 함)*
- **MAU 카드 · SKU 분포 등 통계 확장** — Server 가 데이터를 노출하면 가능. 현재는 통계 표면 골격만 존재. *(Server 통계 endpoint 추가 필요)*
- **Sentry · OpenTelemetry 통합** — SDK 통합 코드는 준비 가능하나 실 trace/crash-free session 값은 외부 계정(Sentry)이 있어야 검증. *(외부 계정·비용)*
- **약관 발행 / 동의 통계 / 사용자 권리 큐 실 연동** — `/dashboard/legal` 과
  `/dashboard/users/rights` 가 client 시그니처와 placeholder fallback 까지 완비.
  Server `/api/v1/admin/legal/terms (GET/POST)`, `/api/v1/admin/legal/consent-stats`,
  `/api/v1/admin/users/rights (GET)`, `/api/v1/admin/users/rights/:id/transition (POST)`
  도입 즉시 swap. 활성 약관 버전 조회는 이미 Server 정본 (`/api/v1/users/consent/active`).
- **피드 / 커머스 / Seed 관리 페이지 실 연동** — `/dashboard/feed`,
  `/dashboard/commerce/products`, `/dashboard/commerce/orders`,
  `/dashboard/ops/seed` 4개 페이지가 client 시그니처와 graceful "준비 중" 안내까지 완비.
  Server `/api/v1/admin/feed/posts*`, `/api/v1/admin/commerce/{products,orders}*`,
  `/api/v1/admin/seed/{status,run}` 신규 endpoint (SERVER 동시 작업)가 배포되면 자동 표시.
  대시보드 홈의 "피드 게시물 (24h)" / "신규 주문 (24h)" KPI 카드도 같은 endpoint 의존.
- **운영팀 수동 진입 — 사용자 추가 / 피드 게시물 작성 / 미디어 업로드** —
  `/dashboard/users/new` · `/dashboard/feed/new` 두 페이지가 client 시그니처와
  graceful "준비 중" 안내까지 완비. 의존 endpoint (SERVER 동시 작업):
  - `POST /api/v1/admin/users` — 운영팀 대리 가입. 약관 4종 동의 + 19+ 본인 확인 강제.
  - `POST /api/v1/admin/feed/posts` — 미디어 URL 배열 포함 게시물 발행.
  - `POST /api/v1/admin/media/upload` (multipart) — 이미지 ≤ 5 MB · 비디오 ≤ 50 MB.
  ADMIN 측 미디어 업로드는 `/api/admin/media/upload` route handler 가 인증 + 프록시
  (브라우저 XHR 가 본문 송신 progress 이벤트를 직접 노출).
- **V1.0 관측성 / SLO / 알람 / 로그 / 운영 제어 실 연동** — `/dashboard/ops/{slo,
  alerts,logs,audit,runbook}` 5개 페이지가 client 시그니처와 graceful "준비 중"
  안내까지 완비. Server `/api/v1/admin/metrics/slo`, `/api/v1/admin/alerts/config*`,
  `/api/v1/admin/logs/search`, `/api/v1/admin/ops/{circuit/:name/close,cache/invalidate,
  maintenance}` 신규 endpoint 배포 즉시 swap. `/dashboard/ops/audit` 와 알람 ack 는
  이미 Server 정본 endpoint 가 있어 실 데이터 동작.
- **회사 정보 (사업자등록) 실 값 표시** — `/api/v1/legal/business-info` 라우트 부재.
  현재 `lib/companyInfo.ts` placeholder ((주)숨코리아 / Soom Korea Inc.) 가 정본.
  *(사업자등록·통신판매업 신고 완료 후 실 값으로 교체)*

### ❌ 당장 불가능 (이유)

- **실 운영자 트래픽 부하 테스트** — 실 사용자 운영자 다수가 동시에 콘솔을 쓰는 시나리오의 실측 부하는 베타 운영 단계 진입 후 가능. *(실 운영 환경 필요)*

### 🔄 운영팀 가이드 — APP 가입 후 ADMIN 즉시 확인

신규 APP 사용자가 정상 등록되었는지 ADMIN 콘솔에서 실시간 확인하는 표준 흐름:

1. APP 에서 사용자가 회원가입 / 게시물 작성 / 상품 추가 등 액션 수행.
2. APP → SERVER `/api/v1/...` 정상 호출 (사용자 가입은 `POST /api/v1/users`).
3. 운영자가 ADMIN 의 해당 페이지 (`/dashboard/users` · `/dashboard/feed` ·
   `/dashboard/content/commerce`) 진입.
4. 우측 상단 "자동 갱신 (10s) — OFF" 토글을 ON 으로 전환. "마지막 조회 HH:MM:SS"
   가 10초마다 업데이트되며, 신규 항목은 행에 **NEW** 칩 + 1초 highlight 로 표시.
5. 확인 완료 후 토글을 OFF 로 되돌리면 polling 즉시 정지 (브라우저 자원 절약).
6. 다른 탭으로 이동 시 자동 일시정지, 돌아오면 즉시 1회 갱신 + 재개.
7. 일시적인 SERVER 5xx 는 토스트로만 안내 (polling 유지). 3회 연속 실패 시 자동
   OFF 로 전환되어 운영자가 의식적으로 재활성화하도록 강제.

### 📋 운영팀 채울 항목 (출시 직전 (주)숨코리아 등록 작업)

본 라운드는 코드 + placeholder + TODO 만 정비. 아래는 사람이 입력/등록해야 하는 값.

- **사업자등록번호** — `lib/companyInfo.ts` 의 `business_registration_no` 를 실
  사업자등록 완료 후 교체 (Server `/api/v1/legal/business-info` 도입 시 그쪽이 정본).
- **통신판매업 신고번호** — 동상. `ecommerce_registration_no`.
- **대표자 / 본사 주소 / 대표 전화** — `lib/companyInfo.ts` 의 동명 필드.
- **개인정보보호책임자 (DPO) 지정** — `privacy_officer` / `privacy_officer_email`.
  PIPA 제31조 의무. App About 화면도 동일 값 노출.
- **약관 4종 본문 (한국어·영어)** — `/dashboard/legal` → 신규 버전 발행에서 법무
  검토 완료 본문 입력 후 활성화. 현재 placeholder 본문은 출시 시점에 절대 활성화 금지.
- **약관 본문 hash 생성 정책** — `body_hash` 컬럼 Server 측 sha256 자동 계산.
  사용자 동의 시점에 hash 함께 저장 → 추후 분쟁 시 무결성 증명.
- **개인정보보호위원회 신고** — 사용자 5만명 이상 또는 민감정보 수집 시 의무.
  (주)숨코리아 출시 전 법무 컨설팅 후 결정.
- **신규 약관 발행 절차 표준화** — 운영팀 SOP: (1) 법무 검토 → (2) 운영 콘솔에서
  staging 발행 → (3) 내부 리뷰 → (4) activate=true 로 재발행 → (5) `/dashboard/notices`
  에 사용자 안내 공지 작성 → (6) 기존 사용자 reconsent 흐름은 App 가 수행.
