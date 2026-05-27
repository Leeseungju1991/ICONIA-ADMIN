export type HeroInput = {
  firmware_critical_count: number;
  reports_pending: number;
  server_health: "ok" | "degraded" | "down";
  dead_letter_count: number;
  errors_24h: number;
};

export type HeroOutput = {
  mode: "critical" | "warn" | "ok";
  title: string;
  subtitle: string;
  cta?: { label: string; href: string };
};

export function resolveHeroMode(input: HeroInput): HeroOutput {
  if (input.firmware_critical_count > 0) {
    return {
      mode: "critical",
      title: `펌웨어 critical ${input.firmware_critical_count}건`,
      subtitle: "현장 디바이스가 영향을 받고 있습니다. 즉시 확인하세요.",
      cta: { label: "펌웨어 에러 열기", href: "/dashboard/firmware-errors" },
    };
  }
  if (input.server_health === "down") {
    return {
      mode: "critical",
      title: "서버 장애 — 즉시 대응 필요",
      subtitle: "ICONIA-SERVER health probe가 down 상태입니다.",
      cta: { label: "운영 안정성 열기", href: "/dashboard/ops" },
    };
  }
  if (input.dead_letter_count > 100) {
    return {
      mode: "critical",
      title: `Dead-letter 적체 ${input.dead_letter_count}건`,
      subtitle: "큐 적체가 임계치를 초과했습니다. 재투입 또는 원인 분석이 필요합니다.",
      cta: { label: "운영 안정성 열기", href: "/dashboard/ops" },
    };
  }
  if (input.reports_pending > 0) {
    return {
      mode: "warn",
      title: `신고 ${input.reports_pending}건 대기`,
      subtitle: "검토를 기다리는 신고가 있습니다.",
      cta: { label: "커뮤니티 모더레이션", href: "/dashboard/community?tab=reported" },
    };
  }
  if (input.server_health === "degraded") {
    return {
      mode: "warn",
      title: "서버 일부 degraded",
      subtitle: "성능 저하 또는 일부 의존성 이상.",
      cta: { label: "운영 안정성 열기", href: "/dashboard/ops" },
    };
  }
  if (input.errors_24h > 1000) {
    return {
      mode: "warn",
      title: `에러 24h ${input.errors_24h.toLocaleString()}건`,
      subtitle: "평소보다 많은 에러가 누적되고 있습니다.",
      cta: { label: "에러 로그 열기", href: "/dashboard/server-errors" },
    };
  }
  return {
    mode: "ok",
    title: "오늘 시스템 정상",
    subtitle: "긴급 처리할 신호가 없습니다. 학습 시간을 가지세요.",
  };
}
