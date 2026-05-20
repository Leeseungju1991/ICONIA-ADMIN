"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { logoutAction } from "@/lib/actions/logout";
import type { IconiaEnvName } from "@/lib/env";
import {
  ROLE_LABEL,
  canAccessPath,
  type OperatorRole,
} from "@/lib/operatorRoles";

type NavItem = {
  to: string;
  label: string;
  icon: (p: { className?: string }) => JSX.Element;
};

const nav: NavItem[] = [
  { to: "/dashboard", label: "대시보드", icon: DashboardIcon },
  { to: "/dashboard/users", label: "회원 관리", icon: UsersIcon },
  { to: "/dashboard/devices", label: "디바이스 모니터링", icon: DeviceIcon },
  { to: "/dashboard/ota", label: "OTA 관리", icon: UploadIcon },
  { to: "/dashboard/personas", label: "AI 페르소나", icon: SparkleIcon },
  { to: "/dashboard/reports", label: "리뷰·신고 관리", icon: FlagIcon },
  { to: "/dashboard/notices", label: "공지/배너 관리", icon: MegaphoneIcon },
  { to: "/dashboard/push", label: "푸시 알림 관리", icon: BellIcon },
  { to: "/dashboard/stats", label: "통계 관리", icon: BarChartIcon },
  { to: "/dashboard/firmware-errors", label: "펌웨어 에러", icon: ChipIcon },
  { to: "/dashboard/server-errors", label: "서버 에러", icon: ServerIcon },
  { to: "/dashboard/app-errors", label: "앱 에러", icon: PhoneIcon },
  { to: "/dashboard/ops", label: "운영 안정성", icon: ShieldIcon },
  { to: "/dashboard/operators", label: "운영자 관리", icon: KeyIcon },
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
    case "/dashboard/users": return "회원 정보 조회·계정 상태·강제 로그아웃 등 정보 관리.";
    case "/dashboard/devices": return "ESP32 인형의 last seen·배터리·펌웨어 버전·연결 상태 모니터링.";
    case "/dashboard/ota": return "펌웨어 업로드·채널 배포·롤백 관리 (ESP32 OTA).";
    case "/dashboard/personas": return "SOUL 파일 업로드·검수·라이브 전환·롤백.";
    case "/dashboard/reports": return "이용자 리뷰와 신고된 게시물을 검토·처리합니다.";
    case "/dashboard/notices": return "앱·웹 공지사항과 메인 배너를 등록·관리합니다.";
    case "/dashboard/push": return "전체/세그먼트 푸시 캠페인을 발송하고 결과를 확인합니다.";
    case "/dashboard/stats": return "사용자·디바이스·매출 지표를 시각화합니다.";
    case "/dashboard/firmware-errors": return "ESP32 OTA 실패·런타임 크래시 로그.";
    case "/dashboard/server-errors": return "AWS API/서비스 5xx·예외·헬스 상태.";
    case "/dashboard/app-errors": return "RN Expo 모바일 앱 크래시·런타임 에러.";
    case "/dashboard/ops": return "observability · tracing · alerting · audit · replay · recovery · kill switch · feature flag.";
    case "/dashboard/operators": return "운영 콘솔 접근 권한 — 운영자 초대·역할 부여·비활성화 (최고관리자 전용).";
    default: return "";
  }
}

export default function Sidebar({
  children,
  env = "development",
  role = "viewer",
  operatorEmail = null,
}: {
  children: ReactNode;
  /** ICONIA_ENV — 헤더 env 배지 표시용. server-side `loadIconiaEnv()` 가 layout 에서 주입. */
  env?: IconiaEnvName;
  /** 운영자 역할 — RBAC 네비게이션 게이팅 + 헤더 배지. */
  role?: OperatorRole;
  /** 운영자 이메일 — 헤더 표시용 (마스킹 없이 본인 식별). */
  operatorEmail?: string | null;
}) {
  const pathname = usePathname() ?? "/dashboard";
  const [navOpen, setNavOpen] = useState(false);
  const { title, subtitle } = pageTitle(pathname);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  return (
    <div
      className="min-h-[100dvh] p-3 sm:p-6"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 0.75rem)",
        paddingRight: "calc(env(safe-area-inset-right) + 0.75rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)",
        paddingLeft: "calc(env(safe-area-inset-left) + 0.75rem)",
      }}
    >
      <div className="mx-auto w-full max-w-[95vw]">
        <div className="relative overflow-hidden rounded-[36px] glass-panel">
          <div className="pointer-events-none absolute -top-40 -right-40 h-96 w-96 rounded-full bg-accentBlue/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-44 -left-44 h-[28rem] w-[28rem] rounded-full bg-accentPink/20 blur-3xl" />

          <div className="relative flex min-h-[calc(100dvh-48px)]">
            <aside className="hidden md:block w-72 shrink-0 p-6 border-r border-white/50">
              <Brand />
              <NavMenu pathname={pathname} role={role} />
              <LogoutButton />
            </aside>

            {navOpen ? (
              <div className="fixed inset-0 z-50 md:hidden">
                <button
                  className="absolute inset-0 bg-black/30"
                  aria-label="메뉴 닫기"
                  onClick={() => setNavOpen(false)}
                />
                <aside className="absolute left-0 top-0 h-full w-72 max-w-[82vw] p-6 border-r border-white/50 glass-panel rounded-r-[28px] shadow-card overflow-y-auto">
                  <div className="flex items-center justify-between mb-6">
                    <Brand compact />
                    <button
                      className="rounded-xl px-3 py-2 bg-white/70 border border-white/70 text-slate-600 text-sm"
                      onClick={() => setNavOpen(false)}
                      type="button"
                    >
                      닫기
                    </button>
                  </div>
                  <NavMenu pathname={pathname} role={role} />
                  <LogoutButton />
                </aside>
              </div>
            ) : null}

            <main className="flex-1 min-w-0 p-4 sm:p-6 pb-10 overflow-x-hidden">
              <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3">
                  <button
                    className="md:hidden mt-1 rounded-2xl px-3 py-2 glass hover:bg-white/70 border border-white/60 text-slate-700"
                    type="button"
                    onClick={() => setNavOpen(true)}
                    aria-label="메뉴 열기"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="text-base">☰</span>
                      <span className="text-sm font-medium">메뉴</span>
                    </span>
                  </button>
                  <div>
                    <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                      {title}
                    </h1>
                    <p className="text-sm text-muted mt-1">{subtitle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <EnvBadge env={env} />
                  <RoleBadge role={role} email={operatorEmail} />
                </div>
              </header>

              {children}
            </main>
          </div>
        </div>
      </div>
    </div>
  );
}

// EnvBadge — 운영자가 현재 콘솔의 환경 (prod/staging/dev) 을 한 눈에 구분.
// prod 는 강조(빨강), staging 은 주황, dev 는 회색. 잘못된 환경에서의 운영자 실수 차단.
function EnvBadge({ env }: { env: IconiaEnvName }) {
  const map: Record<IconiaEnvName, { label: string; chip: string; title: string }> = {
    production: {
      label: "PROD",
      chip: "chip chip-error",
      title: "운영 환경 (production) — 실 사용자 데이터입니다. 모든 액션은 즉시 영향.",
    },
    staging: {
      label: "STAGING",
      chip: "chip chip-warn",
      title: "스테이징 환경 — QA / 회귀 테스트 전용. 실 사용자 데이터 아님.",
    },
    development: {
      label: "DEV",
      chip: "chip chip-muted",
      title: "개발 환경 — 로컬/테스트. mock 데이터.",
    },
  };
  const meta = map[env];
  return (
    <span className={meta.chip} title={meta.title} aria-label={`현재 환경: ${meta.label}`}>
      {meta.label}
    </span>
  );
}

// RoleBadge — 현재 운영자의 RBAC 역할을 헤더에 표시. 권한 색상 구분으로
// 운영자가 자신의 접근 범위를 즉시 인지 (superadmin 빨강·sre/secops 파랑·cs 청록·viewer 회색).
function RoleBadge({
  role,
  email,
}: {
  role: OperatorRole;
  email: string | null;
}) {
  const chip: Record<OperatorRole, string> = {
    superadmin: "chip chip-error",
    sre: "chip chip-info",
    secops: "chip chip-info",
    cs: "chip chip-success",
    viewer: "chip chip-muted",
  };
  return (
    <span
      className={chip[role]}
      title={email ? `운영자: ${email} · 역할: ${ROLE_LABEL[role]}` : `역할: ${ROLE_LABEL[role]}`}
      aria-label={`운영자 역할: ${ROLE_LABEL[role]}`}
    >
      {ROLE_LABEL[role]}
    </span>
  );
}

function Brand({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "mb-2" : "mb-6"}>
      <div className="flex items-center gap-2">
        <div className="h-10 w-10 rounded-2xl bg-white/70 border border-white/70 shadow-sm flex items-center justify-center">
          <span className="text-accent font-black">I</span>
        </div>
        <div>
          <div className="font-extrabold tracking-tight text-slate-900">ICONIA</div>
          <div className="text-xs text-muted -mt-0.5">Admin Console</div>
        </div>
      </div>
    </div>
  );
}

function NavMenu({ pathname, role }: { pathname: string; role: OperatorRole }) {
  // RBAC — 현재 역할이 접근 불가한 메뉴는 애초 숨김 (viewer 가 비활성 버튼을 누르고
  // 403 을 받는 대신 링크 자체 제거). 강제 차단은 middleware 가 별도 수행.
  const visibleNav = nav.filter((item) => canAccessPath(role, item.to));
  return (
    <nav className="space-y-1">
      {visibleNav.map((item) => {
        const isActive = item.to === "/dashboard"
          ? pathname === "/dashboard"
          : pathname.startsWith(item.to);
        return (
          <Link
            key={item.to}
            href={item.to}
            className={[
              "flex items-center gap-3 px-4 py-3 rounded-2xl text-sm transition",
              "hover:bg-white/60",
              isActive ? "bg-white/70 text-slate-900 shadow-card" : "text-slate-600",
            ].join(" ")}
          >
            <item.icon className="w-5 h-5 text-accent" />
            <span className="font-medium">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function LogoutButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <div className="mt-6">
      <button
        className="w-full rounded-2xl px-4 py-3 text-sm bg-white/50 border border-white/60 hover:bg-white/70 transition text-slate-700 disabled:opacity-60"
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
    </div>
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
