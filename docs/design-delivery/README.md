# ICONIA Admin — UI/UX 디자인 시안 전달 문서

> 목적: 이미 구현된 ICONIA 운영 콘솔(Next.js 웹앱)의 UI/UX를 디자이너·기획자·클라이언트에게
> 공유하기 위한 전달용 문서입니다. **기능(메뉴 그룹) 단위로 묶고, 그 안을 페이지 단위로
> 나누는 하이브리드 구조**를 따릅니다 — 실제 사이드바 메뉴 구조(`app/dashboard/Sidebar.tsx`)를
> 그대로 섹션 순서로 사용해, 개발 구조와 전달 문서 구조가 어긋나지 않도록 했습니다.
>
> 함께 보면 좋은 자료: [`style-guide.html`](./style-guide.html) — 실제 Tailwind 토큰으로 만든
> 정적 컬러/컴포넌트 스타일 가이드 (브라우저에서 바로 열람 가능, 빌드 불필요).

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

## 5. 신규 제안 — LLM 기반 화면: AI 운영 코파일럿

> 함께 보면 좋은 자료: [`llm-copilot-mockup.html`](./llm-copilot-mockup.html) — 아래 내용을
> 기존 디자인 시스템 그대로 적용한 정적 목업 (브라우저에서 바로 열람 가능).

### 5.1 배경

현재 "AI 운영" 그룹에는 Key 관리 / 페르소나 / 기능 플래그가 있고, 히든 라우트로
`knowledge`(RAG 질의 테스트)가 있습니다. 이 화면들은 "설정을 조작"하는 화면이지,
운영자가 **자연어로 운영 데이터를 질의**하는 화면은 아직 없습니다. 그 빈 자리를 채우는
신규 화면 제안입니다 — 운영 로그, 감사 로그, 사용자 360, 커머스 주문 등 여러 테이블에
흩어진 데이터를 운영자가 자연어 질문 한 번으로 조회하게 하는 것이 목표입니다.
(BigQuery류 데이터 웨어하우스를 백엔드로 붙이는 경우에도 화면 설계는 동일하게 적용됩니다.)

- **배치 위치**: `[AI 운영]` 그룹 최상단, 신규 경로 `/dashboard/ai-copilot`
- **권한**: `operator` 이상 (읽기 전용 질의만 — 실행형 액션은 기존 화면으로 딥링크)

### 5.2 레이아웃

```
┌─────────────────────────────────────────────┐
│  PanelCard: "AI 운영 코파일럿"                 │
│  ┌───────────────────────────────────────┐   │
│  │ 대화 히스토리 (스크롤)                    │   │
│  │  · 운영자 질문 (우측 정렬 bubble)          │   │
│  │  · AI 답변 (좌측, 근거 출처 chip 포함)      │   │
│  │    [출처: ops_logs · 2026-09-20~27]      │   │
│  │    [표로 보기] [해당 화면으로 이동 →]       │   │
│  └───────────────────────────────────────┘   │
│  ┌───────────────────────────────────────┐   │
│  │ 입력창 + 전송 버튼 + "예시 질문" 칩 3개     │   │
│  └───────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 5.3 상태별 시안 (필수)

| 상태 | 설명 |
|---|---|
| **idle / 첫 진입** | 대화 없음 — 예시 질문 칩("이번주 5xx 에러 top5", "미해결 모더레이션 추이") 노출 |
| **질의 중(스트리밍)** | 답변 텍스트가 토큰 단위로 흘러나옴 — 커서 깜빡임 표시, 중단 버튼 노출 |
| **답변 + 출처** | 답변 하단에 인용한 테이블/기간을 chip으로 표시 (RAG 화면과 동일한 패턴 재사용) |
| **표 응답** | 질문이 목록성일 때 텍스트 대신 `DataTable` 컴포넌트를 인라인 렌더 |
| **모호한 질문** | "다음 중 어떤 걸 원하시나요?" 형태로 되묻는 선택 칩 제공 (바로 추측 답변 금지) |
| **권한 초과 질문** | 예: viewer가 결제 정보 질의 → 답변 대신 `ForbiddenNotice` 톤의 안내 |
| **속도 제한/과부하** | 기존 AI Key 관리 화면의 "사용량 초과" 배지와 동일한 톤(주황)으로 안내 + 재시도 안내 |
| **에러** | LLM 호출 실패 — 재시도 버튼 + "질문을 다시 입력해주세요" 안내 |

### 5.4 지켜야 할 원칙

- **환각 방지 우선**: 모든 답변에 반드시 출처(테이블명 + 기간)를 붙인다 — 출처 없는 답변은 UI 레벨에서 렌더링 자체를 막는 것을 권장
- **읽기 전용**: 코파일럿에서 직접 "삭제/잠금" 같은 파괴적 액션을 실행하지 않음 — 항상 해당 화면으로 딥링크 후 `DangerConfirmDialog`를 거치게 함
- **감사 로그 연동**: 코파일럿에 입력된 질문/응답도 `ops/audit`에 기록 (개인정보 질의 오남용 추적)
- **기존 디자인 언어 재사용**: 새로운 컬러·컴포넌트를 만들지 않고 accent/PanelCard/DataTable/AdminToast를 그대로 사용 — 전체 콘솔과 이질감 없어야 함

---

## 6. 전달 방법 (실무 옵션)

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
