"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Drawer from "@mui/material/Drawer";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListSubheader from "@mui/material/ListSubheader";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { LogoutButton } from "@/app/components/LogoutButton";
import { SidebarNavItem } from "./SidebarNavItem";
import type { NavItem } from "./navConfig";

export const SIDEBAR_WIDTH = 250;

type Identity = { email: string | null; role: string | null };

function SidebarContent({
  visibleNav,
  identity,
  onNavigate,
}: {
  visibleNav: NavItem[];
  identity: Identity;
  onNavigate?: () => void;
}) {
  const mainNav = visibleNav.filter((n) => n.group !== "commerce");
  const commerceNav = visibleNav.filter((n) => n.group === "commerce");

  return (
    <Box
      sx={{
        width: SIDEBAR_WIDTH,
        height: "100%",
        background: "linear-gradient(195deg, #42424a, #191919)",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Box sx={{ px: 3, py: 3 }}>
        <Typography variant="h6" sx={{ color: "#ffffff", fontWeight: 700, letterSpacing: "0.5px" }}>
          ICONIA Admin
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)" }}>
          운영 콘솔
        </Typography>
      </Box>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />

      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        <List dense sx={{ py: 0 }}>
          {mainNav.map((item) => (
            <SidebarNavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              onNavigate={onNavigate}
            />
          ))}
        </List>
        {commerceNav.length > 0 ? (
          <>
            <ListSubheader
              disableSticky
              sx={{
                background: "transparent",
                color: "rgba(255,255,255,0.55)",
                fontSize: "0.6875rem",
                lineHeight: "32px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                px: 3,
                mt: 1,
              }}
            >
              Commerce
            </ListSubheader>
            <List dense sx={{ py: 0 }}>
              {commerceNav.map((item) => (
                <SidebarNavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  onNavigate={onNavigate}
                />
              ))}
            </List>
          </>
        ) : null}
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
      <Stack spacing={1} sx={{ p: 2 }}>
        {identity.email ? (
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.75)", wordBreak: "break-all" }}>
            {identity.email}
          </Typography>
        ) : null}
        {identity.role ? (
          <Chip
            label={identity.role}
            size="small"
            sx={{
              alignSelf: "flex-start",
              backgroundColor: "rgba(26,115,232,0.2)",
              color: "#90caf9",
              fontWeight: 600,
              height: 22,
              fontSize: "0.6875rem",
            }}
          />
        ) : null}
        <LogoutButton />
      </Stack>
    </Box>
  );
}

export function Sidebar({
  visibleNav,
  identity,
}: {
  visibleNav: NavItem[];
  identity: Identity;
}) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isDesktop) {
    return (
      <Drawer
        variant="permanent"
        anchor="left"
        open
        PaperProps={{
          sx: {
            width: SIDEBAR_WIDTH,
            border: 0,
            boxShadow: "0 4px 20px 0 rgba(0,0,0,0.14)",
            backgroundColor: "transparent",
            overflow: "hidden",
          },
        }}
      >
        <SidebarContent visibleNav={visibleNav} identity={identity} />
      </Drawer>
    );
  }

  return (
    <>
      <IconButton
        aria-label="메뉴 열기"
        onClick={() => setMobileOpen(true)}
        sx={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: (t) => t.zIndex.drawer + 1,
          backgroundColor: "#ffffff",
          boxShadow: 2,
          "&:hover": { backgroundColor: "#f5f5f5" },
        }}
      >
        <MenuIcon />
      </IconButton>
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        ModalProps={{ keepMounted: true }}
        PaperProps={{
          sx: { width: SIDEBAR_WIDTH, border: 0, backgroundColor: "transparent" },
        }}
      >
        <Box sx={{ position: "absolute", top: 8, right: 8, zIndex: 1 }}>
          <IconButton
            aria-label="메뉴 닫기"
            onClick={() => setMobileOpen(false)}
            sx={{ color: "rgba(255,255,255,0.8)" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <SidebarContent
          visibleNav={visibleNav}
          identity={identity}
          onNavigate={() => setMobileOpen(false)}
        />
      </Drawer>
    </>
  );
}
