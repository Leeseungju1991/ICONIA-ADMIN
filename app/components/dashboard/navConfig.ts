import type { OperatorRole } from "@/lib/operatorRoles";

// Navigation 설정 — Sidebar / Breadcrumbs 공통 소비.
// allowedRoles 가 있으면 해당 role 만 보이고, group 으로 묶이면 Sidebar 가 ListSubheader 로 구분.
// 아이콘은 sidebar 가 lazy import (아이콘 이름만 string 으로 휴대).

export type NavIconName =
  | "Dashboard"
  | "People"
  | "Router"
  | "Memory"
  | "MonitorHeart"
  | "MenuBook"
  | "Shield"
  | "FactCheck"
  | "AdminPanelSettings"
  | "Inventory2"
  | "ReceiptLong"
  | "Webhook";

export type NavItem = {
  href: string;
  label: string;
  icon: NavIconName;
  allowedRoles?: OperatorRole[];
  group?: "main" | "commerce";
};

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "개요", icon: "Dashboard", group: "main" },
  { href: "/dashboard/users", label: "사용자", icon: "People", allowedRoles: ["superadmin", "sre", "secops", "cs"], group: "main" },
  { href: "/dashboard/devices", label: "디바이스", icon: "Router", allowedRoles: ["superadmin", "sre", "secops"], group: "main" },
  { href: "/dashboard/firmware", label: "펌웨어 배포", icon: "Memory", allowedRoles: ["superadmin", "sre", "secops"], group: "main" },
  { href: "/dashboard/ai-health", label: "AI 상태", icon: "MonitorHeart", group: "main" },
  { href: "/dashboard/knowledge", label: "Knowledge Base", icon: "MenuBook", group: "main" },
  { href: "/dashboard/posts", label: "게시물 모더레이션", icon: "Shield", group: "main" },
  { href: "/dashboard/audit", label: "Audit 로그", icon: "FactCheck", allowedRoles: ["superadmin", "sre", "secops"], group: "main" },
  { href: "/dashboard/operators", label: "운영자", icon: "AdminPanelSettings", allowedRoles: ["superadmin"], group: "main" },
  { href: "/dashboard/commerce/products", label: "상품", icon: "Inventory2", group: "commerce" },
  { href: "/dashboard/commerce/orders", label: "주문", icon: "ReceiptLong", group: "commerce" },
  { href: "/dashboard/commerce/webhooks", label: "웹훅", icon: "Webhook", group: "commerce" },
];

// 브레드크럼 라벨 매핑 — 알려진 path 는 한글 label, 모르는 segment 는 원본 그대로.
export const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  users: "사용자",
  devices: "디바이스",
  firmware: "펌웨어 배포",
  "ai-health": "AI 상태",
  knowledge: "Knowledge Base",
  posts: "게시물 모더레이션",
  audit: "Audit 로그",
  export: "CSV Export",
  operators: "운영자",
  commerce: "Commerce",
  products: "상품",
  orders: "주문",
  webhooks: "웹훅",
};
