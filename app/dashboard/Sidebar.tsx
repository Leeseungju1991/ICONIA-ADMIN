"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { logoutAction } from "@/lib/actions/logout";
import type { IconiaEnvName } from "@/lib/env";
import {
  canAccessPath,
  type OperatorRole,
} from "@/lib/operatorRoles";
import { TopbarRich } from "./_components/TopbarRich";

type NavChild = { to: string; label: string };

type NavItem = {
  to: string;
  label: string;
  icon: (p: { className?: string }) => JSX.Element;
  /** moderation 등 미해결 카운트를 표시할지. badge 값은 prop 으로 별도 주입. */
  badge?: "moderation";
  /** 시각적 강조 (모더레이션 — 자극적이지 않게 빨강 dot 만). */
  highlightWhenBadge?: boolean;
  /** 아코디언 그룹 — 펼치면 children 들이 들여쓰기 표시. 본 항목 자체는 토글 버튼. */
  children?: NavChild[];
};

// 2026-05-28 — 운영자 요청으로 9개 카테고리만 노출.
// 기존 페이지(cs, users, devices, ota, factory-test, as, boot-invariants,
// personas, knowledge, moderation, reports, ops/*, operators, ip-allowlist,
// firmware-errors, server-errors, app-errors, notices, push, notifications,
// content)는 라우트 보존되지만 사이드바에서 숨김.
const nav: NavItem[] = [
  { to: "/dashboard", label: "대시보드", icon: DashboardIcon },
  { to: "/dashboard/user-360", label: "사용자 정보", icon: UsersIcon },
  { to: "/dashboard/ai-usage", label: "AI 사용량", icon: SparkleIcon },
  { to: "/dashboard/gemini", label: "Gemini Key 관리", icon: KeyIcon },
  {
    to: "/dashboard/content",
    label: "콘텐츠 (피드/커머스/도감)",
    icon: BookIcon,
    children: [
      { to: "/dashboard/feed", label: "피드" },
      { to: "/dashboard/content/commerce", label: "커머스" },
      { to: "/dashboard/content/catalog", label: "도감" },
    ],
  },
  // 2026-06-01 — 사용자 요청: 아코디언 하위 진입 제거. "커머스 (배너)" 클릭 시 곧장 배너 페이지.
  { to: "/dashboard/commerce/banners", label: "커머스 (배너)", icon: ReceiptIcon },
  { to: "/dashboard/info/faqs", label: "FAQ 관리", icon: LifebuoyIcon },
  { to: "/dashboard/reports", label: "신고된 피드", icon: MegaphoneIcon },
  { to: "/dashboard/notice-push", label: "공지·푸시 관리", icon: BellIcon },
  { to: "/dashboard/error-tracking", label: "오류 추적", icon: ServerIcon },
  { to: "/dashboard/audit", label: "감사 로그", icon: ShieldIcon },
];

// 사이드바에서 빠졌지만 직접 URL 입력 시 노출되는 페이지들의 타이틀 (TopbarRich 용).
const HIDDEN_TITLES: Record<string, string> = {
  "/dashboard/cs": "CS 통합 조회",
  "/dashboard/users": "회원 관리",
  "/dashboard/users/rights": "사용자 권리 큐",
  "/dashboard/devices": "디바이스 모니터링",
  "/dashboard/ota-deploy": "OTA 업로드·배포",
  "/dashboard/ota": "OTA 모니터링",
  "/dashboard/factory-test": "양산·출고 검수",
  "/dashboard/as": "AS·교환 관리",
  "/dashboard/boot-invariants": "Fleet 출하 잠금",
  "/dashboard/personas": "AI 페르소나",
  "/dashboard/knowledge": "RAG·대화 품질",
  "/dashboard/moderation": "모더레이션",
  "/dashboard/community": "신고된 피드 (legacy)",
  "/dashboard/notifications": "공지/알람 작성",
  "/dashboard/notices": "공지/배너 관리",
  "/dashboard/push": "푸시 알림 관리",
  "/dashboard/firmware-errors": "펌웨어 에러",
  "/dashboard/server-errors": "서버 에러",
  "/dashboard/app-errors": "앱 에러",
  "/dashboard/ops": "운영 안정성",
  "/dashboard/ops/slo": "운영 — SLO 대시보드",
  "/dashboard/ops/alerts": "운영 — 알람 설정",
  "/dashboard/ops/logs": "운영 — 로그 검색",
  "/dashboard/ops/audit": "운영 — 감사 로그",
  "/dashboard/ops/runbook": "운영 — 장애 runbook",
  "/dashboard/ops/seed": "운영 — Seed 상태",
  "/dashboard/operators": "운영자 관리",
  "/dashboard/ip-allowlist": "IP 허용목록",
  "/dashboard/content/commerce": "커머스 상품",
  "/dashboard/content/catalog": "인형 도감",
  "/dashboard/notice-push": "공지·푸시 관리",
};

function pageTitle(pathname: string): { title: string; subtitle: string } {
  // 자식 라우트 (children) 도 검색 대상에 포함.
  const flat: Array<{ to: string; label: string }> = [];
  for (const n of nav) {
    flat.push({ to: n.to, label: n.label });
    if (n.children) for (const c of n.children) flat.push(c);
  }
  const item = flat
    .filter((n) => n.to !== "/dashboard")
    .sort((a, b) => b.to.length - a.to.length)
    .find((n) => pathname === n.to || pathname.startsWith(`${n.to}/`));
  if (item) {
    return { title: item.label, subtitle: subtitleFor(item.to) };
  }
  const hidden = Object.entries(HIDDEN_TITLES)
    .sort((a, b) => b[0].length - a[0].length)
    .find(([k]) => pathname === k || pathname.startsWith(`${k}/`));
  if (hidden) {
    return { title: hidden[1], subtitle: subtitleFor(hidden[0]) };
  }
  return { title: "대시보드", subtitle: "ICONIA 운영 콘솔 — 주요 지표를 한눈에 확인하세요." };
}

function subtitleFor(to: string): string {
  switch (to) {
    case "/dashboard/ai-usage": return "Gemini API Key 사용량 — 키별 일일 한도, 모델별 분포, 24h/7d/30d 시계열.";
    case "/dashboard/gemini": return "Gemini API Key 관리 — quota 추적, 업그레이드 추천, 키 추가 가이드.";
    case "/dashboard/info/faqs": return "앱·웹 FAQ 등록·수정·비공개 처리.";
    case "/dashboard/commerce": return "커머스 표면 운영 — 배너 / 주문 read-only.";
    case "/dashboard/commerce/banners": return "메인 배너 등록·정렬·노출 기간 관리.";
    case "/dashboard/commerce/orders": return "주문 조회 (display-only) — 결제·환불 액션 없음.";
    case "/dashboard/audit": return "AuditLog 통합 뷰어 — secops+ 전용. action / outcome / 운영자 / 기간 필터.";
    case "/dashboard/moderation": return "미해결 신고 통합 — 욕설/혐오/스팸 게시물·댓글·사용자·리뷰를 한 화면에서 처리.";
    case "/dashboard/error-tracking": return "기능별 24시간 에러 — 스택, 빈도, 영향 사용자 수.";
    case "/dashboard/ota-deploy": return "펌웨어 업로드 + 디바이스 그룹 선택 + 단계 배포.";
    case "/dashboard/notifications": return "전체 / 사용자군 / 디바이스군 대상 앱푸시 + 인앱 배너 작성 발송.";
    case "/dashboard/content": return "피드 · 커머스 · 도감 — 세 콘텐츠 표면 진입.";
    case "/dashboard/content/commerce": return "커머스 상품 가격 정보 — 상품 추가·제거.";
    case "/dashboard/content/catalog": return "인형 도감 — 도감 항목 추가·제거.";
    case "/dashboard/cs": return "고객센터 1차 응대 — 이메일/시리얼/사용자ID 한 줄 검색으로 사용자·기기·최근 오류·조치 패널을 한 화면에 표시.";
    case "/dashboard/knowledge": return "RAG 질의 테스트·출처 조회·사용자 피드백 — AI 답변이 근거 있게 생성됐는지 점검합니다.";
    case "/dashboard/users": return "회원 정보 조회·계정 상태·강제 로그아웃 등 정보 관리.";
    case "/dashboard/user-360": return "한 사용자의 이메일·UUID·디바이스·계정 상태를 한 화면에서 조회·관리.";
    case "/dashboard/devices": return "ESP32 인형의 last seen·배터리·펌웨어 버전·연결 상태 모니터링.";
    case "/dashboard/ota": return "펌웨어 업로드·채널 배포·롤백 관리 (ESP32 OTA).";
    case "/dashboard/personas": return "SOUL 파일 업로드·검수·라이브 전환·롤백.";
    case "/dashboard/reports": return "이용자 리뷰와 신고된 게시물을 검토·처리합니다.";
    case "/dashboard/community": return "신고된 피드 목록 — 각 항목의 [삭제] 버튼으로 takedown 처리.";
    case "/dashboard/feed": return "피드 게시물 검색·숨김·복구·삭제 + 댓글 미리보기.";
    case "/dashboard/notices": return "앱·웹 공지사항과 메인 배너를 등록·관리합니다.";
    case "/dashboard/notice-push": return "공지·배너 작성 + 푸시 알림 발송 통합.";
    case "/dashboard/users/rights": return "PIPA 제35/36/37조 사용자 권리 요청 (열람·정정·삭제·이관) 큐.";
    case "/dashboard/push": return "전체 사용자 푸시 알림을 작성·발송합니다.";
    case "/dashboard/firmware-errors": return "ESP32 OTA 실패·런타임 크래시 로그.";
    case "/dashboard/server-errors": return "AWS API/서비스 5xx·예외·헬스 상태.";
    case "/dashboard/app-errors": return "RN Expo 모바일 앱 크래시·런타임 에러.";
    case "/dashboard/ops": return "observability · tracing · alerting · audit · replay · recovery · kill switch · feature flag.";
    case "/dashboard/ops/slo": return "API p50/p95/p99 · error rate · AI fallback · DB · 외부 의존성 — 5분 sliding window.";
    case "/dashboard/ops/alerts": return "SLO 위반 알람 임계치 · 활성화 · 채널 (이메일/슬랙). 변경은 사유 5자 + audit_log.";
    case "/dashboard/ops/logs": return "운영 로그 검색 — request-id / user-id / endpoint / status / level / 시간 범위. PII 는 마스킹.";
    case "/dashboard/ops/audit": return "감사 로그 뷰어 — 운영자 변경 작업 hash chain. CSV export 지원.";
    case "/dashboard/ops/runbook": return "장애 대응 절차 모음 + 수동 운영 작업 (circuit close · cache invalidate · 메인터넌스 모드).";
    case "/dashboard/ops/seed": return "Seed 상태 + 수동 트리거 — SEED 확인 문구 + 사유 5자 이상 + audit_log 영구 기록.";
    case "/dashboard/factory-test": return "양산 LOT 생성 · 시리얼 일괄 발급 · 출고 검수 결과 입력. 펌웨어 production_test 가 자동 업로드한 결과는 LOT 별 yield 로 집계.";
    case "/dashboard/as": return "AS 접수·교체 기기 등록·회수 기기 잠금·종료. 신규 티켓은 이전 owner 페어링을 자동 force-unpair.";
    case "/dashboard/boot-invariants": return "Fleet 전체 출하 잠금 invariant 위반 추적 (Secure Boot·Flash Enc·JTAG Disable·OTA Anti-Rollback). 양산 라인 burn 실수 진단.";
    case "/dashboard/operators": return "운영 콘솔 접근 권한 — 운영자 초대·역할 부여·비활성화 (최고관리자 전용).";
    default: return "";
  }
}

export default function Sidebar({
  children,
  env: _env = "development",
  role = "viewer",
  operatorEmail = null,
  moderationOpenCount = 0,
}: {
  children: ReactNode;
  /** ICONIA_ENV — layout 에서 주입 (현재 미사용, 향후 환경 분기용). */
  env?: IconiaEnvName;
  /** 운영자 역할 — RBAC 네비게이션 게이팅. */
  role?: OperatorRole;
  /** 운영자 이메일 — layout 에서 주입. TopbarRich 우측 프로필 칩에 표시. */
  operatorEmail?: string | null;
  /** 모더레이션 미해결 신고 수 — 사이드바 배지 + 대시보드 강조용. */
  moderationOpenCount?: number;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const [navOpen, setNavOpen] = useState(false);
  const { title, subtitle } = pageTitle(pathname);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // 2026-05-22 — NCP/NAVER Works 라이트 사이드바 구조.
  //   외곽 glass shell + decorative blur 폐기. 풀폭 사이드바(좌) + 흰 톱바 + 캔버스 본문.
  return (
    <div
      className="min-h-[100dvh] flex bg-canvas"
      style={{
        paddingTop: "env(safe-area-inset-top)",
        paddingRight: "env(safe-area-inset-right)",
        paddingBottom: "env(safe-area-inset-bottom)",
        paddingLeft: "env(safe-area-inset-left)",
      }}
    >
      {/* 데스크탑 사이드바 — 흰 배경, 우측 하단 1px 보더, sticky.
          lg(1024px) 미만에서는 햄버거 드로어 사용 (태블릿 포함). */}
      <aside className="hidden lg:flex lg:flex-col w-60 lg:w-64 shrink-0 bg-surface border-r border-slate-200 sticky top-0 h-[100dvh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100">
          <Brand />
        </div>
        <div className="p-3 flex-1 overflow-y-auto">
          <NavMenu pathname={pathname} role={role} moderationOpenCount={moderationOpenCount} />
        </div>
        <div className="p-3 border-t border-slate-100">
          <LogoutButton />
        </div>
      </aside>

      {/* 모바일/태블릿 드로어 — 동일 흰 사이드바를 슬라이드 인. lg 미만 모두 적용. */}
      {navOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-slate-900/40"
            aria-label="메뉴 닫기"
            onClick={() => setNavOpen(false)}
          />
          <aside className="absolute left-0 top-0 h-full w-72 max-w-[82vw] bg-surface border-r border-slate-200 shadow-card overflow-y-auto flex flex-col">
            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
              <Brand compact />
              <button
                className="rounded-lg px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm transition"
                onClick={() => setNavOpen(false)}
                type="button"
              >
                닫기
              </button>
            </div>
            <div className="p-3 flex-1 overflow-y-auto">
              <NavMenu pathname={pathname} role={role} moderationOpenCount={moderationOpenCount} />
            </div>
            <div className="p-3 border-t border-slate-100">
              <LogoutButton />
            </div>
          </aside>
        </div>
      ) : null}

      {/* 메인 컬럼 — sticky 흰 톱바 + 캔버스 본문. */}
      <div className="flex-1 min-w-0 flex flex-col">
        <TopbarRich title={title} subtitle={subtitle} operatorEmail={operatorEmail ?? null} onOpenMenu={() => setNavOpen(true)} />

        <main className="flex-1 min-w-0 p-4 sm:p-6 pb-10 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function Brand({ compact: _compact }: { compact?: boolean }) {
  // 2026-06-01 — 로고/타이틀 영역을 메인 대시보드 link 로. 클릭 시 /dashboard 로 이동.
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 hover:opacity-80 transition">
      <div className="h-9 w-9 rounded-lg bg-accent text-white shadow-soft flex items-center justify-center">
        <span className="font-black text-base">I</span>
      </div>
      <div>
        <div className="font-bold tracking-tight text-slate-900 text-[15px]">ICONIA</div>
        <div className="text-[11px] text-muted -mt-0.5">Admin Console</div>
      </div>
    </Link>
  );
}

function NavMenu({
  pathname,
  role,
  moderationOpenCount,
}: {
  pathname: string;
  role: OperatorRole;
  moderationOpenCount: number;
}) {
  // 콘텐츠 등 자식 메뉴 아코디언 — pathname 이 자식 경로에 있으면 자동 펼침.
  const initialOpen = nav
    .filter((n) =>
      n.children?.some(
        (c) => pathname === c.to || pathname.startsWith(`${c.to}/`),
      ) ?? false,
    )
    .map((n) => n.to);
  const [openIds, setOpenIds] = useState<string[]>(initialOpen);

  function toggle(to: string) {
    setOpenIds((cur) => (cur.includes(to) ? cur.filter((x) => x !== to) : [...cur, to]));
  }

  // RBAC — 현재 역할이 접근 불가한 메뉴는 애초 숨김 (viewer 가 비활성 버튼을 누르고
  // 403 을 받는 대신 링크 자체 제거). 강제 차단은 middleware 가 별도 수행.
  const visibleNav = nav.filter((item) => canAccessPath(role, item.to));
  return (
    <nav className="space-y-0.5">
      {visibleNav.map((item) => {
        const hasChildren = !!item.children?.length;
        const isExpanded = openIds.includes(item.to);
        const isOnSelfOrChild =
          item.to === "/dashboard"
            ? pathname === "/dashboard"
            : pathname === item.to ||
              pathname.startsWith(`${item.to}/`) ||
              (item.children?.some(
                (c) => pathname === c.to || pathname.startsWith(`${c.to}/`),
              ) ?? false);
        const badgeCount = item.badge === "moderation" ? moderationOpenCount : 0;
        const showHighlight = item.highlightWhenBadge && badgeCount > 0;

        const baseRowCls = [
          "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition w-full",
          isOnSelfOrChild
            ? "bg-accent/10 text-accent font-semibold"
            : showHighlight
              ? "text-rose-700 hover:bg-rose-50"
              : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        ].join(" ");
        const iconCls = [
          "w-[18px] h-[18px]",
          isOnSelfOrChild
            ? "text-accent"
            : showHighlight
              ? "text-rose-500"
              : "text-slate-400",
        ].join(" ");

        return (
          <div key={item.to}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggle(item.to)}
                aria-expanded={isExpanded}
                className={baseRowCls}
              >
                <item.icon className={iconCls} />
                <span className="truncate flex-1 text-left">{item.label}</span>
                <Caret className="w-3.5 h-3.5 text-slate-400" open={isExpanded} />
              </button>
            ) : (
              <Link href={item.to} className={baseRowCls}>
                <item.icon className={iconCls} />
                <span className="truncate flex-1">{item.label}</span>
                {badgeCount > 0 ? (
                  <span
                    className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold px-1.5"
                    aria-label={`미해결 ${badgeCount}건`}
                  >
                    {badgeCount > 99 ? "99+" : badgeCount}
                  </span>
                ) : null}
              </Link>
            )}

            {hasChildren && isExpanded ? (
              <div className="mt-0.5 ml-9 space-y-0.5">
                {item.children!.map((c) => {
                  const childActive = pathname === c.to || pathname.startsWith(`${c.to}/`);
                  return (
                    <Link
                      key={c.to}
                      href={c.to}
                      className={[
                        "block px-3 py-2 rounded-lg text-[12.5px] transition",
                        childActive
                          ? "bg-accent/10 text-accent font-semibold"
                          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                      ].join(" ")}
                    >
                      {c.label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

function Caret({ open, className }: { open: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={[className ?? "", open ? "rotate-180 transition" : "transition"].join(" ")}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function LogoutButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      className="w-full rounded-lg px-3 py-2.5 text-[13px] bg-white border border-slate-300 hover:bg-slate-50 transition text-slate-700 disabled:opacity-60"
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          // server action: cookie 정리 + Server /api/v1/operator/logout 호출 + redirect.
          await logoutAction();
        });
      }}
    >
      {isPending ? "로그아웃 중..." : "로그아웃"}
    </button>
  );
}

/* ========================= Icons ========================= */

function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 13h7V4H4v9zM13 20h7V11h-7v9zM13 4h7v5h-7V4zM4 20h7v-5H4v5z" />
    </svg>
  );
}
function UsersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M16 14a4 4 0 1 0-8 0" />
      <circle cx="12" cy="7" r="4" />
      <path d="M2 21a8 8 0 0 1 16 0M22 21a6 6 0 0 0-6-6" />
    </svg>
  );
}
function FlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 21V4l14 6-14 6" />
    </svg>
  );
}
function MegaphoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 11v2a2 2 0 0 0 2 2h2l8 4V5L7 9H5a2 2 0 0 0-2 2z" />
      <path d="M18 8a4 4 0 0 1 0 8" />
    </svg>
  );
}
function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16l-2-2zM10 21a2 2 0 0 0 4 0" />
    </svg>
  );
}
function BarChartIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />
    </svg>
  );
}
function ChipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="5" width="14" height="14" rx="2" />
      <path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3" />
    </svg>
  );
}
function ServerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="4" width="18" height="6" rx="2" />
      <rect x="3" y="14" width="18" height="6" rx="2" />
      <path d="M7 7h.01M7 17h.01" />
    </svg>
  );
}
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="7" y="2" width="10" height="20" rx="2" />
      <path d="M11 18h2" />
    </svg>
  );
}
function DeviceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3a4 4 0 0 0-4 4v3a4 4 0 1 0 8 0V7a4 4 0 0 0-4-4z" />
      <path d="M5 14h14M7 14v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-5" />
    </svg>
  );
}
function UploadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 21h14" />
    </svg>
  );
}
function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v6M12 15v6M3 12h6M15 12h6M6 6l3 3M15 15l3 3M18 6l-3 3M9 15l-3 3" />
    </svg>
  );
}
function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3l8 3v6c0 4.5-3.5 8-8 9-4.5-1-8-4.5-8-9V6l8-3z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
function KeyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="8" cy="15" r="5" />
      <path d="M11.5 11.5L20 3M17 6l2 2M14 9l2 2" />
    </svg>
  );
}
function LifebuoyIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M4.9 4.9l4.2 4.2M14.9 14.9l4.2 4.2M19.1 4.9l-4.2 4.2M9.1 14.9l-4.2 4.2" />
    </svg>
  );
}
function BookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4z" />
      <path d="M4 17a3 3 0 0 1 3-3h11" />
      <path d="M8 8h7M8 12h5" />
    </svg>
  );
}
function FactoryIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 21h18M5 21V9l4 3V9l4 3V9l6 4v8" />
      <path d="M8 17h2M12 17h2M16 17h2" />
    </svg>
  );
}
function WrenchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a4 4 0 0 0-5.7 5.7L3 18l3 3 6-6a4 4 0 0 0 5.7-5.7l-3 3-2-2 3-3z" />
    </svg>
  );
}
function ReportIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M7 3h10l3 3v15a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h1z" />
      <path d="M8 11h8M8 15h5M8 7h6" />
    </svg>
  );
}
function FeedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 6h16M4 12h16M4 18h10" />
    </svg>
  );
}
function BoxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 7l9-4 9 4-9 4-9-4z" />
      <path d="M3 7v10l9 4 9-4V7" />
      <path d="M12 11v10" />
    </svg>
  );
}
function ReceiptIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2z" />
      <path d="M9 7h6M9 11h6M9 15h4" />
    </svg>
  );
}
function SeedIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22v-7" />
      <path d="M12 15c-4 0-6-3-6-7 4 0 6 3 6 7z" />
      <path d="M12 15c4 0 6-3 6-7-4 0-6 3-6 7z" />
    </svg>
  );
}
