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
import { COMPANY_INFO_PLACEHOLDER } from "@/lib/companyInfo";

type NavItem = {
  to: string;
  label: string;
  icon: (p: { className?: string }) => JSX.Element;
};

const nav: NavItem[] = [
  { to: "/dashboard", label: "대시보드", icon: DashboardIcon },
  { to: "/dashboard/cs", label: "CS 통합 조회", icon: LifebuoyIcon },
  { to: "/dashboard/users", label: "회원 관리", icon: UsersIcon },
  { to: "/dashboard/devices", label: "디바이스 모니터링", icon: DeviceIcon },
  { to: "/dashboard/ota", label: "OTA 관리", icon: UploadIcon },
  { to: "/dashboard/personas", label: "AI 페르소나", icon: SparkleIcon },
  { to: "/dashboard/knowledge", label: "RAG·대화 품질", icon: BookIcon },
  { to: "/dashboard/reports", label: "리뷰·신고 관리", icon: FlagIcon },
  { to: "/dashboard/notices", label: "공지/배너 관리", icon: MegaphoneIcon },
  { to: "/dashboard/legal", label: "약관·법률 관리", icon: BookIcon },
  { to: "/dashboard/users/rights", label: "사용자 권리 큐", icon: ShieldIcon },
  { to: "/dashboard/push", label: "푸시 알림 관리", icon: BellIcon },
  { to: "/dashboard/stats", label: "통계 관리", icon: BarChartIcon },
  { to: "/dashboard/firmware-errors", label: "펌웨어 에러", icon: ChipIcon },
  { to: "/dashboard/server-errors", label: "서버 에러", icon: ServerIcon },
  { to: "/dashboard/app-errors", label: "앱 에러", icon: PhoneIcon },
  { to: "/dashboard/ops", label: "운영 안정성", icon: ShieldIcon },
  { to: "/dashboard/factory-test", label: "양산·출고 검수", icon: FactoryIcon },
  { to: "/dashboard/as", label: "AS·교환 관리", icon: WrenchIcon },
  { to: "/dashboard/boot-invariants", label: "Fleet 출하 잠금", icon: ShieldIcon },
  { to: "/dashboard/reports-archive", label: "운영 리포트 아카이브", icon: ReportIcon },
  { to: "/dashboard/operators", label: "운영자 관리", icon: KeyIcon },
  { to: "/dashboard/ip-allowlist", label: "IP 허용목록", icon: ShieldIcon },
];

function pageTitle(pathname: string): { title: string; subtitle: string } {
  const item = nav.find((n) => n.to !== "/dashboard" && pathname.startsWith(n.to));
  if (item) {
    return { title: item.label, subtitle: subtitleFor(item.to) };
  }
  return { title: "대시보드", subtitle: "ICONIA 운영 콘솔 — 주요 지표를 한눈에 확인하세요." };
}

function subtitleFor(to: string): string {
  switch (to) {
    case "/dashboard/cs": return "고객센터 1차 응대 — 이메일/시리얼/사용자ID 한 줄 검색으로 사용자·기기·최근 오류·조치 패널을 한 화면에 표시.";
    case "/dashboard/knowledge": return "RAG 질의 테스트·출처 조회·사용자 피드백 — AI 답변이 근거 있게 생성됐는지 점검합니다.";
    case "/dashboard/users": return "회원 정보 조회·계정 상태·강제 로그아웃 등 정보 관리.";
    case "/dashboard/devices": return "ESP32 인형의 last seen·배터리·펌웨어 버전·연결 상태 모니터링.";
    case "/dashboard/ota": return "펌웨어 업로드·채널 배포·롤백 관리 (ESP32 OTA).";
    case "/dashboard/personas": return "SOUL 파일 업로드·검수·라이브 전환·롤백.";
    case "/dashboard/reports": return "이용자 리뷰와 신고된 게시물을 검토·처리합니다.";
    case "/dashboard/notices": return "앱·웹 공지사항과 메인 배너를 등록·관리합니다.";
    case "/dashboard/legal": return "약관 4종 활성 버전·본문 미리보기·신버전 발행. (주)숨코리아 사업자 정보.";
    case "/dashboard/users/rights": return "PIPA 제35/36/37조 사용자 권리 요청 (열람·정정·삭제·이관) 큐.";
    case "/dashboard/push": return "전체/세그먼트 푸시 캠페인을 발송하고 결과를 확인합니다.";
    case "/dashboard/stats": return "사용자·디바이스·매출 지표를 시각화합니다.";
    case "/dashboard/firmware-errors": return "ESP32 OTA 실패·런타임 크래시 로그.";
    case "/dashboard/server-errors": return "AWS API/서비스 5xx·예외·헬스 상태.";
    case "/dashboard/app-errors": return "RN Expo 모바일 앱 크래시·런타임 에러.";
    case "/dashboard/ops": return "observability · tracing · alerting · audit · replay · recovery · kill switch · feature flag.";
    case "/dashboard/factory-test": return "양산 LOT 생성 · 시리얼 일괄 발급 · 출고 검수 결과 입력. 펌웨어 production_test 가 자동 업로드한 결과는 LOT 별 yield 로 집계.";
    case "/dashboard/as": return "AS 접수·교체 기기 등록·회수 기기 잠금·종료. 신규 티켓은 이전 owner 페어링을 자동 force-unpair.";
    case "/dashboard/boot-invariants": return "Fleet 전체 출하 잠금 invariant 위반 추적 (Secure Boot·Flash Enc·JTAG Disable·OTA Anti-Rollback). 양산 라인 burn 실수 진단.";
    case "/dashboard/reports-archive": return "리뷰·신고 처리 결과 보관. 매일 02:00 / 일요일 02:30 KST 자동 생성. 수동 트리거는 최고관리자.";
    case "/dashboard/operators": return "운영 콘솔 접근 권한 — 운영자 초대·역할 부여·비활성화 (최고관리자 전용).";
    default: return "";
  }
}

export default function Sidebar({
  children,
  env: _env = "development",
  role = "viewer",
  operatorEmail: _operatorEmail = null,
}: {
  children: ReactNode;
  /** ICONIA_ENV — layout 에서 주입 (현재 미사용, 향후 환경 분기용). */
  env?: IconiaEnvName;
  /** 운영자 역할 — RBAC 네비게이션 게이팅. */
  role?: OperatorRole;
  /** 운영자 이메일 — layout 에서 주입 (현재 미사용). */
  operatorEmail?: string | null;
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
      {/* 데스크탑 사이드바 — 흰 배경, 우측 하단 1px 보더, sticky. */}
      <aside className="hidden md:flex md:flex-col w-60 lg:w-64 shrink-0 bg-surface border-r border-slate-200 sticky top-0 h-[100dvh] overflow-y-auto">
        <div className="p-5 border-b border-slate-100">
          <Brand />
        </div>
        <div className="p-3 flex-1 overflow-y-auto">
          <NavMenu pathname={pathname} role={role} />
        </div>
        <CompanyFooter />
        <div className="p-3 border-t border-slate-100">
          <LogoutButton />
        </div>
      </aside>

      {/* 모바일 드로어 — 동일 흰 사이드바를 슬라이드 인. */}
      {navOpen ? (
        <div className="fixed inset-0 z-50 md:hidden">
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
              <NavMenu pathname={pathname} role={role} />
            </div>
            <CompanyFooter />
            <div className="p-3 border-t border-slate-100">
              <LogoutButton />
            </div>
          </aside>
        </div>
      ) : null}

      {/* 메인 컬럼 — sticky 흰 톱바 + 캔버스 본문. */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-10 bg-surface border-b border-slate-200 px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="md:hidden rounded-lg px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
              type="button"
              onClick={() => setNavOpen(true)}
              aria-label="메뉴 열기"
            >
              <span className="inline-flex items-center gap-2">
                <span className="text-base">☰</span>
              </span>
            </button>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-semibold tracking-tight text-slate-900 truncate">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-muted mt-0.5 truncate">{subtitle}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 min-w-0 p-4 sm:p-6 pb-10 overflow-x-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}

function Brand({ compact: _compact }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="h-9 w-9 rounded-lg bg-accent text-white shadow-soft flex items-center justify-center">
        <span className="font-black text-base">I</span>
      </div>
      <div>
        <div className="font-bold tracking-tight text-slate-900 text-[15px]">ICONIA</div>
        <div className="text-[11px] text-muted -mt-0.5">Admin Console</div>
      </div>
    </div>
  );
}

function NavMenu({ pathname, role }: { pathname: string; role: OperatorRole }) {
  // RBAC — 현재 역할이 접근 불가한 메뉴는 애초 숨김 (viewer 가 비활성 버튼을 누르고
  // 403 을 받는 대신 링크 자체 제거). 강제 차단은 middleware 가 별도 수행.
  const visibleNav = nav.filter((item) => canAccessPath(role, item.to));
  return (
    <nav className="space-y-0.5">
      {visibleNav.map((item) => {
        const isActive = item.to === "/dashboard"
          ? pathname === "/dashboard"
          : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            href={item.to}
            className={[
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] transition",
              isActive
                ? "bg-accent/10 text-accent font-semibold"
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
            ].join(" ")}
          >
            <item.icon className={["w-[18px] h-[18px]", isActive ? "text-accent" : "text-slate-400"].join(" ")} />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// (주)숨코리아 사업자 정보 footer — 모든 운영자가 콘솔 좌측 하단에서 회사 정체성을
// 즉시 확인. Server `/api/v1/legal/business-info` 도입 전까지는 placeholder.
// 상세 표기는 /dashboard/legal 페이지가 한다 (여기는 1줄 요약 + 링크).
function CompanyFooter() {
  return (
    <div className="px-3 py-2 border-t border-slate-100 text-[10px] text-slate-500 leading-tight">
      <div className="font-semibold text-slate-700">
        {COMPANY_INFO_PLACEHOLDER.company_name_ko}
      </div>
      <div>{COMPANY_INFO_PLACEHOLDER.company_name_en}</div>
      <Link
        href="/dashboard/legal"
        className="mt-1 inline-block text-accent hover:underline"
      >
        사업자 정보 보기 →
      </Link>
    </div>
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
