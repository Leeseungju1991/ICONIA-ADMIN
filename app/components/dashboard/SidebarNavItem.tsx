"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import DashboardOutlined from "@mui/icons-material/DashboardOutlined";
import PeopleOutlined from "@mui/icons-material/PeopleOutlined";
import RouterOutlined from "@mui/icons-material/RouterOutlined";
import MemoryOutlined from "@mui/icons-material/MemoryOutlined";
import MonitorHeartOutlined from "@mui/icons-material/MonitorHeartOutlined";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import ShieldOutlined from "@mui/icons-material/ShieldOutlined";
import FactCheckOutlined from "@mui/icons-material/FactCheckOutlined";
import AdminPanelSettingsOutlined from "@mui/icons-material/AdminPanelSettingsOutlined";
import Inventory2Outlined from "@mui/icons-material/Inventory2Outlined";
import ReceiptLongOutlined from "@mui/icons-material/ReceiptLongOutlined";
import WebhookOutlined from "@mui/icons-material/WebhookOutlined";
import type { NavIconName } from "./navConfig";

// 아이콘 이름(string) → MUI 컴포넌트 매핑.
const ICONS: Record<NavIconName, React.ComponentType<{ fontSize?: "small" | "inherit" | "large" | "medium" }>> = {
  Dashboard: DashboardOutlined,
  People: PeopleOutlined,
  Router: RouterOutlined,
  Memory: MemoryOutlined,
  MonitorHeart: MonitorHeartOutlined,
  MenuBook: MenuBookOutlined,
  Shield: ShieldOutlined,
  FactCheck: FactCheckOutlined,
  AdminPanelSettings: AdminPanelSettingsOutlined,
  Inventory2: Inventory2Outlined,
  ReceiptLong: ReceiptLongOutlined,
  Webhook: WebhookOutlined,
};

export function SidebarNavItem({
  href,
  label,
  icon,
  onNavigate,
}: {
  href: string;
  label: string;
  icon: NavIconName;
  onNavigate?: () => void;
}) {
  const pathname = usePathname() ?? "";
  // /dashboard 는 정확 일치, 나머지는 prefix 일치.
  const active =
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href);
  const Icon = ICONS[icon];

  return (
    <ListItem disablePadding sx={{ px: 2, py: 0.25 }}>
      <ListItemButton
        component={Link}
        href={href}
        onClick={onNavigate}
        selected={active}
        sx={{
          borderRadius: 1.5,
          color: active ? "#1A73E8" : "rgba(255,255,255,0.85)",
          backgroundColor: active ? "#ffffff" : "transparent",
          minHeight: 40,
          "&:hover": {
            backgroundColor: active ? "#ffffff" : "rgba(255,255,255,0.08)",
          },
          "&.Mui-selected": {
            backgroundColor: "#ffffff",
            color: "#1A73E8",
            "&:hover": { backgroundColor: "#ffffff" },
          },
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: 36,
            color: active ? "#1A73E8" : "rgba(255,255,255,0.85)",
          }}
        >
          <Icon fontSize="small" />
        </ListItemIcon>
        <ListItemText
          primary={label}
          primaryTypographyProps={{
            fontSize: "0.875rem",
            fontWeight: active ? 600 : 500,
          }}
        />
      </ListItemButton>
    </ListItem>
  );
}
