# ICONIA Admin — UI/UX 디자인 시안 전달 문서

> 목적: 이미 구현된 ICONIA 운영 콘솔(Next.js 웹앱)의 UI/UX를 디자이너·기획자·클라이언트에게
> 공유하기 위한 전달용 문서입니다. **기능(메뉴 그룹) 단위로 묶고, 그 안을 페이지 단위로
> 나누는 하이브리드 구조**를 따릅니다 — 실제 사이드바 메뉴 구조(`app/dashboard/Sidebar.tsx`)를
> 그대로 섹션 순서로 사용해, 개발 구조와 전달 문서 구조가 어긋나지 않도록 했습니다.
>
> 함께 보면 좋은 자료: [`style-guide.html`](./style-guide.html) — **20개 카테고리**로 정리한
> 인터랙티브 스타일 가이드. 이 웹앱이 실제로 쓰는 전역 유틸리티 클래스(`.btn-*` / `.input` /
> `.chip-*` / `.glass-*` 등)와 컴포넌트 14종에, 아직 앱엔 없지만 일반 웹앱에서 널리 쓰이는
> 패턴 6종(브레드크럼·드롭다운·툴팁·스켈레톤/시머·진행바+스텝퍼·스낵바 로딩/실행취소 변형)을
> 더했습니다. 프레임워크 없이 바닐라 JS ~120줄로 대부분 실제 클릭 가능한 동작 데모입니다
> (브라우저에서 바로 열람 가능, 빌드 불필요). 자세한 20종 목록은 §1.4 참고.

---

## 0. 개요

| 항목 | 내용 |
|---|---|
| 서비스 | ICONIA Operator / CS / SRE 운영 콘솔 |
| 형태 | Next.js 15 (App Router) + Tailwind CSS, 서버 컴포넌트 중심 |
| 대상 사용자 | 운영자(Operator), CS 담당자, SRE — 역할별 RBAC로 메뉴 노출 제어 |
| 인증 | 이메일/비밀번호 로그인 + 2FA(TOTP + 백업 코드) |
| 화면 수 | 사이드바 노출 20+ / 히든(직접 URL) 포함 40+ 라우트 |

### 사이트맵 (기능 그룹 → 페이지)

```
로그인 · 인증
├─ 로그인                         /login
└─ 2FA 등록 · 백업 코드           /security/2fa

대시보드 홈                        /dashboard

[그룹] 사용자 · 디바이스
├─ 사용자 조회 (360)              /dashboard/user-360
├─ 회원 관리                      /dashboard/users
│   └─ 회원 추가                  /dashboard/users/new
│   └─ 사용자 권리 큐             /dashboard/users/rights
├─ CS 통합 조회                   /dashboard/cs
├─ 디바이스 모니터링              /dashboard/devices
├─ OTA 배포                       /dashboard/ota-deploy
├─ 양산 · 출고 검수               /dashboard/factory-test
└─ AS · 교환 관리                 /dashboard/as

[그룹] 콘텐츠 · 모더레이션
├─ 콘텐츠 관리 (아코디언)         /dashboard/content
│   ├─ 피드                       /dashboard/feed (+ /feed/new)
│   ├─ 커머스                     /dashboard/content/commerce
│   └─ 도감                       /dashboard/content/catalog
├─ 모더레이션 (배지)              /dashboard/moderation
├─ 분실 · 도난 신고               /dashboard/lost-reports
├─ FAQ 관리                       /dashboard/info/faqs
└─ 공지 · 푸시 관리                /dashboard/notice-push

[그룹] AI 운영
├─ AI Key 관리                    /dashboard/gemini
├─ AI 페르소나                    /dashboard/personas
└─ 기능 플래그                    /dashboard/feature-flags

[그룹] 시스템 · 운영
├─ 오류 추적                      /dashboard/error-tracking
├─ 운영 안정성 (아코디언)         /dashboard/ops
│   ├─ 로그 검색                  /dashboard/ops/logs
│   ├─ 감사 로그                  /dashboard/ops/audit
│   ├─ 장애 Runbook               /dashboard/ops/runbook
│   └─ Seed 상태                  /dashboard/ops/seed
└─ 운영자 관리                    /dashboard/operators

[히든 — 직접 URL만 지원]
IP 허용목록 · 커머스 배너/주문 · 에러 3종(서버/앱/펌웨어) ·
AI/BYOK 사용량 · 약관 관리 등 (표 2-6 참고)
```

이 사이트맵은 코드에서 자동 생성된 것이 아니라 실제 `navGroups` 선언을 옮긴 것이므로,
라우트가 바뀌면 이 문서도 함께 갱신해야 합니다.

---

## 1. 디자인 시스템 (Foundation)

실제 `tailwind.config.js`에 정의된 토큰 그대로입니다. 임의로 지어낸 값이 아니라
지금 화면에 적용 중인 값입니다.

### 1.1 컬러

| 토큰 | 값 | 용도 |
|---|---|---|
| `accent` | `#6D5DFE` | 브랜드 프라이머리 — 활성 네비, 프라이머리 버튼, 포커스 링 |
| `accentPink` | `#EC4899` | 보조 강조 (StatCard 그라데이션 등) |
| `accentBlue` | `#60A5FA` | 보조 강조 |
| `accentOrange` | `#F97316` | 보조 강조 / 경고성 하이라이트 |
| `accentTeal` | `#14B8A6` | 보조 강조 |
| `canvas` | `#F5F6F8` | 페이지 배경 |
| `surface` | `#FFFFFF` | 카드 · 사이드바 배경 |
| `hairline` | `#E5E7EB` | 1px 보더 |
| `rose-500/700` | Tailwind 기본 | 위험 상태 (모더레이션 미해결 배지 등) |

디자인 톤: **NCP/NAVER Works 스타일의 라이트 어드민** — 흰 사이드바 + 흰 톱바 + 연회색
캔버스, 카드에 미세한 그림자(`shadow-card`)만 사용. 예전에 검토했던 다크 사이드바 +
MUI 블루 리스킨 안(`docs/2026-05-18-mui-redesign-plan.md`)은 폐기되었고, 현재는
Tailwind 기반 라이트 테마로 확정되어 있습니다 — 시안 전달 시 혼선이 없도록 과거 문서는
"폐기된 안"으로 표시해 두었습니다.

### 1.2 타이포그래피 / 형태

| 토큰 | 값 |
|---|---|
| 카드 radius | `xl` 12px / `2xl` 16px |
| 버튼 radius | 8–10px (컴포넌트별 `rounded-lg` 사용) |
| 카드 그림자 | `shadow-card` — `0 1px 2px rgba(15,23,42,.04), 0 1px 3px rgba(15,23,42,.06)` |
| 강조 그림자 | `shadow-soft` — `0 6px 18px rgba(109,93,254,.18)` (프라이머리 버튼 글로우) |
| 본문 텍스트 | `text-slate-900` (제목) / `text-slate-600` (본문) / `text-muted` (보조) |

### 1.3 공통 컴포넌트 (`app/dashboard/_components/`)

| 컴포넌트 | 역할 | 시안에 포함할 상태 |
|---|---|---|
| `PanelCard` | 섹션 컨테이너 (title + description + actions + children) | 기본 / actions 유무 |
| `StatCard` | KPI 요약 카드 (accent 5색, delta 방향 up/down/flat) | 5개 accent × 3개 delta tone |
| `KpiChip` / `KpiSparkline` | 작은 지표 칩 + 스파크라인 | 기본 |
| `DataTable` | 전 대시보드 공용 표 — 클라이언트 페이지네이션(기본 25행) 내장, 커서 페이지네이션 지원 | **empty**, 로딩, 페이지네이션 바 유무, 커서 다음/이전 |
| `ExpandableRow` | 표 행 확장 | 접힘 / 펼침 |
| `DangerConfirmDialog` | 파괴적 작업 확인 모달 (강제 로그아웃, 계정 잠금 등) | 기본 / 사유 입력 필수형 |
| `ForbiddenNotice` | RBAC 권한 없음 안내 | — |
| `AdminToast` | 성공/실패 토스트 | success / error |
| `TopbarRich` | 페이지 타이틀 + 부제 + 프로필 칩 + 모바일 메뉴 버튼 | 데스크탑 / 모바일 |
| `Sidebar` + `NavMenu` | 4개 그룹 아코디언 네비, RBAC로 항목 숨김, 모더레이션 배지 | 데스크탑 고정 / 모바일 드로어 |

> 시안 문서에는 이 표에 있는 컴포넌트들의 상태(empty, loading, error, disabled)를
> 반드시 스크린샷으로 포함하세요 — 실제 리뷰에서 가장 많이 나오는 질문이 "빈 화면/에러일 때는
> 어떻게 보이나요?" 입니다.

### 1.4 스타일 가이드 20종 (`style-guide.html`)

전역 유틸리티 클래스와 컴포넌트를 **20개 카테고리**로 묶었습니다. **적용중**은
`app/globals.css` / `app/dashboard/_components/`에 실제로 있는 스타일, **제안**은 아직
앱엔 없지만 일반 웹앱에서 널리 쓰여서 이 문서가 새로 더한 패턴입니다. 괄호 안은 실물 데모에서
클릭해볼 수 있는 상호작용입니다.

| # | 카테고리 | 상태 | 근거 / 데모 |
|---|---|---|---|
| 1 | 컬러 토큰 | 적용중 | `tailwind.config.js` accent 5색 + canvas/surface/hairline |
| 2 | 타이포그래피 · 스페이싱 | 적용중 | 제목/본문/보조 텍스트 스케일, radius, shadow |
| 3 | 버튼 | 적용중 | `.btn-primary/-outline/-danger` (로딩 상태·아이콘 버튼 클릭 데모) |
| 4 | 폼 입력 | 적용중 | `.input`/`.select` (검색 X 지우기, 비밀번호 보기/숨기기 실동작) |
| 5 | 체크박스 · 라디오 · 토글 | 적용중 | `role="switch"` 토글 (클릭 시 실제 on/off 전환) |
| 6 | 배지 · 칩 | 적용중 | `.chip-info/-warn/-error/-success/-muted` |
| 7 | 카드 | 적용중 | `.glass-card`/`.glass-panel`, StatCard 5색 |
| 8 | 탭 | 적용중 | AI Key 관리 모델 하위탭 (클릭 시 패널 전환) |
| 9 | 아코디언 / 펼침 행 | 적용중 | 오류 추적 "스택 펼치기" (클릭 시 펼침/접힘) |
| 10 | 브레드크럼 | **제안** | 깊은 라우트(상품 상세 등)에서 상위 경로 표시 |
| 11 | 드롭다운 메뉴 | **제안** | 표 행 "⋯" 액션 메뉴 (바깥 클릭 시 자동 닫힘) |
| 12 | 툴팁 | **제안** | 순수 CSS `::after` — hover/focus로 표시 |
| 13 | 내비게이션 | 적용중 | 사이드바 4그룹 아코디언 + RBAC 숨김 + 배지 |
| 14 | 배너 · 알림 | 적용중 | `ForbiddenNotice`(amber) / 폼 에러(red), 닫기 가능 |
| 15 | 스낵바 · 토스트 | 적용중 + **제안** | `AdminToast` 4톤 + **로딩→완료 전환**, **실행취소(undo) + X 닫기** 변형 |
| 16 | 모달 / 확인 다이얼로그 | 적용중 | `DangerConfirmDialog` danger/primary (버튼으로 실제 열고 닫기, ESC 지원) |
| 17 | 표 · 페이지네이션 | 적용중 | `DataTable` 25행 기본 + 신규 행 1초 amber fade |
| 18 | 스켈레톤 · 시머 이펙트 | **제안** | CSS 그라데이션 애니메이션 (로딩⇄로드완료 토글 데모) |
| 19 | 진행 표시줄 · 스텝퍼 | **제안** | OTA 배포·양산 검수 같은 다단계 흐름용 (진행률 버튼으로 애니메이션) |
| 20 | 상태 · 유틸리티 | 적용중 | empty/loading/error/forbidden + 클립보드 복사(실동작) + 인쇄 + 모션감소 + 모바일 줌방지 |

> §15의 스낵바 데모는 사용자가 요청한 3가지 예시를 그대로 구현했습니다 — **로딩 표기**(스피너 →
> 완료 시 성공 스낵바로 자동 전환), **X 닫기**(모든 스낵바 공통), **실행취소(undo)**(삭제 스낵바에
> "실행 취소" 버튼 + 5초 타이머 진행바, 타임아웃 전 클릭하면 액션이 취소됨).

---

## 2. 기능 그룹별 화면

### 2.0 로그인 · 인증

| 페이지 | 경로 | 설명 |
|---|---|---|
| 로그인 | `/login` | 이메일/비밀번호 로그인. `LoginForm.tsx` |
| 2FA 등록 | `/security/2fa` | TOTP 등록(QR) + 백업 코드 발급/재발급 (`TwoFactorEnroll`, `BackupCodePanel`) |

**포함할 상태**: 기본 입력 / 유효성 에러 / 로그인 실패(잠금 임박 경고) / 2FA 코드 오류 / 백업 코드 재발급 확인.

### 2.1 사용자 · 디바이스

| 페이지 | 경로 | 설명 |
|---|---|---|
| 사용자 조회 (360) | `/dashboard/user-360` | 이메일·UUID·디바이스·계정 상태를 한 화면에서 조회 |
| 회원 관리 | `/dashboard/users` | 회원 정보·계정 상태·강제 로그아웃 (`UsersClient.tsx`) |
| └ 회원 추가 | `/dashboard/users/new` | 신규 계정 생성 폼 |
| └ 사용자 권리 큐 | `/dashboard/users/rights` | PIPA 열람·정정·삭제·이관 요청 처리 |
| CS 통합 조회 | `/dashboard/cs` | 이메일/시리얼/사용자ID 한 줄 검색 → 사용자·기기·오류·조치 패널 |
| 디바이스 모니터링 | `/dashboard/devices` | ESP32 인형 last seen·배터리·펌웨어·연결 상태 |
| OTA 배포 | `/dashboard/ota-deploy` | 펌웨어 업로드 + 디바이스 그룹 선택 + 단계 배포 |
| 양산 · 출고 검수 | `/dashboard/factory-test` | LOT 생성 · 시리얼 일괄 발급 · 출고 검수 결과, yield 집계 |
| AS · 교환 관리 | `/dashboard/as` | AS 접수·교체 기기 등록·회수 기기 잠금 |

**공통으로 챙길 상태**: 검색 결과 없음, 강제 로그아웃/잠금 확인 모달(DangerConfirmDialog),
권한 부족(ForbiddenNotice — 예: viewer 롤이 회원 삭제 버튼에 접근 시).

### 2.2 콘텐츠 · 모더레이션

| 페이지 | 경로 | 설명 |
|---|---|---|
| 콘텐츠 관리 (아코디언 상위) | `/dashboard/content` | 피드/커머스/도감 진입 허브 |
| └ 피드 | `/dashboard/feed` (+ `/feed/new`) | 게시물 검색·숨김·복구·삭제 + 댓글 미리보기 |
| └ 커머스 | `/dashboard/content/commerce` (+ `[productId]`) | 상품 가격 정보 추가·제거 |
| └ 도감 | `/dashboard/content/catalog` | 도감 항목 추가·제거 |
| 모더레이션 | `/dashboard/moderation` | 미해결 신고 통합 처리, 사이드바 배지(빨강 dot)로 강조 |
| 분실 · 도난 신고 | `/dashboard/lost-reports` | 접수된 신고 검토·처리 |
| FAQ 관리 | `/dashboard/info/faqs` | FAQ 등록·수정·비공개 |
| 공지 · 푸시 관리 | `/dashboard/notice-push` | 공지/배너 작성 + 푸시 발송 통합 |

**포함할 상태**: 모더레이션 배지 0건/N건(빨강 강조), 게시물 삭제 확인, 발행 예약 상태.

### 2.3 AI 운영

| 페이지 | 경로 | 설명 |
|---|---|---|
| AI Key 관리 | `/dashboard/gemini` | Key 등록·회전·비활성 + 사용량 게이지, 회전 시 감사로그 자동 기록 |
| AI 페르소나 | `/dashboard/personas` | SOUL 파일 업로드·검수·라이브 전환·롤백 |
| 기능 플래그 | `/dashboard/feature-flags` | 사용자별 빌드타임 플래그 override (feed/doll/mypage/commerce/rag) |

**포함할 상태**: 사용량 게이지 정상/경고/초과, 페르소나 롤백 확인 모달.

### 2.4 시스템 · 운영

| 페이지 | 경로 | 설명 |
|---|---|---|
| 오류 추적 | `/dashboard/error-tracking` | 기능별 24시간 에러 — 스택, 빈도, 영향 사용자 수 |
| 운영 안정성 (아코디언) | `/dashboard/ops` | observability·tracing·alerting·kill switch 허브 |
| └ 로그 검색 | `/dashboard/ops/logs` | request-id/user-id/endpoint/status/level 검색, PII 마스킹 |
| └ 감사 로그 | `/dashboard/ops/audit` | 운영자 변경 작업 hash chain, CSV export |
| └ 장애 Runbook | `/dashboard/ops/runbook` | 대응 절차 + 수동 운영 작업(circuit close 등) |
| └ Seed 상태 | `/dashboard/ops/seed` | Seed 확인 + 수동 트리거 (사유 5자 이상 필수) |
| 운영자 관리 | `/dashboard/operators` | 운영자 초대·역할 부여·비활성화 (최고관리자 전용) |

**포함할 상태**: 최고관리자 전용 화면의 권한 없음 화면, 위험 작업(circuit close, seed 트리거) 확인 모달.

### 2.5 히든 라우트 (사이드바 미노출, 직접 URL 지원)

북마크 호환을 위해 라우트만 유지되는 화면들입니다. 시안에는 "레거시/저빈도" 섹션으로
묶어 별도 표기하는 것을 권장합니다.

| 페이지 | 경로 |
|---|---|
| AI 사용량 (집계 뷰) | `/dashboard/ai-usage` |
| BYOK 사용량 | `/dashboard/byok-usage` |
| RAG·대화 품질 | `/dashboard/knowledge` |
| 서버/앱/펌웨어 에러 | `/dashboard/server-errors`, `/dashboard/app-errors`, `/dashboard/firmware-errors` |
| 커머스 표면 (배너/주문) | `/dashboard/commerce`, `/commerce/banners`, `/commerce/orders` |
| IP 허용목록 | `/dashboard/ip-allowlist` |
| 약관·법률 관리 | `/dashboard/legal` |
| Fleet 출하 잠금 | `/dashboard/boot-invariants` |

---

## 3. 반응형 · 예외 케이스 (모든 화면 공통)

디자인 리뷰에서 가장 자주 빠지는 부분이라 별도 체크리스트로 뺐습니다.

- [ ] **모바일/태블릿 (`lg` 미만, 1024px)**: 사이드바가 햄버거 드로어로 전환 (`Sidebar.tsx` 참고)
- [ ] **로딩 상태**: `DataTable` 데이터 fetch 중
- [ ] **빈 상태**: `DataTable`의 `empty` 기본 문구("데이터가 없습니다.") 또는 페이지별 커스텀 empty
- [ ] **에러 상태**: `app/error.tsx`, `app/global-error.tsx` 전역 에러 바운더리
- [ ] **권한 없음**: `ForbiddenNotice` — RBAC로 막힌 메뉴에 직접 URL 접근 시
- [ ] **파괴적 작업 확인**: `DangerConfirmDialog` — 강제 로그아웃, 계정 잠금, circuit close, seed 트리거 등
- [ ] **대량 데이터**: `DataTable` 페이지네이션(25행 기본) / 커서 페이지네이션 전환 지점

---

## 4. 일반 UI/UX 원칙 체크리스트

특정 화면에 종속되지 않고 **레포 전체에 공통 적용**되어야 하는 원칙입니다. 시안 리뷰 시
페이지별 스크린샷과 별개로 이 체크리스트를 함께 전달하면, "왜 이렇게 만들었는지"를
근거와 함께 설명할 수 있습니다.

### 4.1 일관성 (Consistency)
- [ ] 모든 표는 `DataTable` 하나만 사용 (개별 페이지가 표를 새로 만들지 않음)
- [ ] 모든 섹션 컨테이너는 `PanelCard`로 통일 (제목/설명/액션 위치 고정)
- [ ] 위험한 동작(삭제·잠금·강제 로그아웃)은 예외 없이 `DangerConfirmDialog`를 거침
- [ ] accent 컬러(`#6D5DFE`)는 "현재 활성/선택" 의미로만 사용, 그 외 강조에는 보조 accent 4색 사용

### 4.2 피드백 (Feedback & Status)
- [ ] 모든 비동기 액션(저장/삭제/토글)은 성공·실패를 `AdminToast`로 즉시 알림
- [ ] 로딩 중에는 버튼을 `disabled` 처리 + 텍스트 변경(예: "처리 중...") — 중복 클릭 방지
- [ ] 파괴적 작업은 실행 전 "사유 입력" 등 1단계 확인을 거침 (Seed 트리거, circuit close 등은 사유 5자 이상 강제)

### 4.3 오류 예방 및 처리 (Error Prevention)
- [ ] 폼 유효성 에러는 필드 바로 아래에 표시 (모달/토스트로 뭉뚱그리지 않음)
- [ ] 전역 예외는 `app/error.tsx` / `app/global-error.tsx`로 사용자에게 복구 경로(새로고침/재시도) 제공
- [ ] 권한 없는 화면은 빈 화면이 아니라 `ForbiddenNotice`로 "왜 안 보이는지" 명시

### 4.4 접근성 (Accessibility)
- [ ] 아이콘 전용 버튼에는 `aria-label` 부여 (예: 사이드바 "메뉴 닫기")
- [ ] 배지·색상만으로 상태를 전달하지 않고 텍스트(예: "미해결 7건")를 함께 표기
- [ ] 명도 대비 — 본문 텍스트 `text-slate-600` 이상 사용, 보조 텍스트도 `text-slate-400` 이하로 내려가지 않음
- [ ] 키보드 포커스 링이 accent 컬러로 보이도록 유지 (마우스 전용 조작 금지)

### 4.5 반응형 (Responsive)
- [ ] `lg`(1024px) 미만에서 사이드바 → 햄버거 드로어 전환 확인
- [ ] 표는 가로 스크롤이 필요할 때 컨테이너 자체만 스크롤(페이지 전체 스크롤과 분리)
- [ ] 카드 그리드는 `auto-fit`/`auto-fill` 기반으로 1~4열 사이 자연스럽게 축소

### 4.6 성능 체감 (Perceived Performance)
- [ ] `DataTable`은 25행 기본 페이지네이션 — 대량 데이터에서도 첫 렌더가 느려지지 않아야 함
- [ ] 스켈레톤/스피너 없이 빈 화면이 오래 유지되지 않도록 로딩 상태를 반드시 시안에 포함

---

## 5. 전달 방법 (실무 옵션)

| 방법 | 언제 쓰나 | 방법 |
|---|---|---|
| **Figma 역변환** | 디자이너가 직접 수정까지 해야 할 때 | `html.to.design` 플러그인으로 실제 페이지를 Figma 레이어로 가져온 뒤, 위 사이트맵대로 Page/Frame 정리 |
| **Playwright 전 화면 캡처** | 확인만 하면 될 때, 빠르게 스냅샷 공유 | `tests/` 의 기존 Playwright 설정을 재사용해 라우트별 스크린샷 자동화 (로그인 세션 고정 필요) |
| **정적 스타일 가이드** | 컬러/컴포넌트 토큰만 빠르게 보여줄 때 | 본 폴더의 [`style-guide.html`](./style-guide.html) — 빌드 없이 브라우저로 바로 확인 |
| **Storybook** | 컴포넌트 상태를 인터랙티브하게 공유할 때 | 현재 레포엔 미도입 — 필요 시 `app/dashboard/_components/*` 대상으로 추가 검토 |

---

## 변경 이력

- 2026-09-27: 최초 작성. 실제 `Sidebar.tsx` 내비게이션 구조 + `tailwind.config.js` 토큰 기반으로 사이트맵/디자인 시스템 정리.
- 2026-09-27: 일반 UI/UX 원칙 체크리스트(§4) 추가, 신규 LLM 화면 제안 "AI 운영 코파일럿"(§5) 추가 + `llm-copilot-mockup.html` 목업 추가.
- 2026-09-27: LLM 코파일럿 제안 제거(범위 밖으로 정리). `style-guide.html`을 `app/globals.css`의
  전역 유틸리티 클래스(`.btn-*`/`.input`/`.chip-*`/`.glass-*` 등) + 토글·탭·아코디언·모달·
  페이지네이션·배너 등 실제 컴포넌트 패턴까지 포함하는 전체 스타일 가이드로 확장 (§1.4 추가).
- 2026-09-27: `style-guide.html`을 **20개 카테고리**로 재구성 (§1.4 갱신). 기존 14종 + 신규
  6종(브레드크럼/드롭다운/툴팁/스켈레톤·시머/진행바·스텝퍼/스낵바 로딩·실행취소 변형) 추가,
  바닐라 JS ~120줄로 대부분 실제 클릭 동작 구현 (토글/탭/아코디언/드롭다운/모달/스낵바 스택/
  스켈레톤 전환/진행률 애니메이션/클립보드 복사).
