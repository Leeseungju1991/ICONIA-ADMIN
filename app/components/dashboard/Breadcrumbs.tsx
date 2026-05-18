"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import MuiBreadcrumbs from "@mui/material/Breadcrumbs";
import Typography from "@mui/material/Typography";
import NavigateNextIcon from "@mui/icons-material/NavigateNext";
import { BREADCRUMB_LABELS } from "./navConfig";

// Pathname → breadcrumbs.
// /dashboard/devices/abc → Dashboard / 디바이스 / abc
// 마지막 segment 가 동적 ID(예: UUID)인 경우 그대로 표시 (id 라벨이 없음).
// /dashboard/users/[id] 는 마지막 segment 가 잘려 보임 — 보기엔 8자 prefix 표시 권장이지만
// 페이지 헤더가 별도 타이틀(이메일)을 출력하므로 여기서는 raw id 그대로 둔다.

export function DashboardBreadcrumbs() {
  const pathname = usePathname() ?? "/dashboard";
  const segments = pathname.split("/").filter(Boolean);
  // 첫 segment 는 dashboard 가 아닌 페이지면 무시 (dashboard 내부에서만 사용).
  if (segments[0] !== "dashboard") {
    return null;
  }

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = BREADCRUMB_LABELS[seg] ?? truncate(seg);
    const isLast = i === segments.length - 1;
    return { href, label, isLast };
  });

  return (
    <MuiBreadcrumbs
      separator={<NavigateNextIcon fontSize="small" sx={{ color: "rgba(0,0,0,0.4)" }} />}
      aria-label="breadcrumb"
      sx={{ fontSize: "0.8125rem" }}
    >
      {crumbs.map((c) =>
        c.isLast ? (
          <Typography
            key={c.href}
            color="text.primary"
            sx={{ fontSize: "0.8125rem", fontWeight: 600 }}
          >
            {c.label}
          </Typography>
        ) : (
          <Link
            key={c.href}
            href={c.href}
            style={{
              color: "rgba(0,0,0,0.55)",
              textDecoration: "none",
              fontSize: "0.8125rem",
            }}
          >
            {c.label}
          </Link>
        ),
      )}
    </MuiBreadcrumbs>
  );
}

function truncate(s: string): string {
  if (s.length <= 16) return s;
  return s.slice(0, 8) + "…";
}
