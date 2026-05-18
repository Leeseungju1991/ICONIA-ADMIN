"use client";

// ICONIA Admin theme — Material Dashboard React 시각 시그니처를 MUI v5 로 재현.
// Reference: https://demos.creative-tim.com/material-dashboard-react
// 결정 요약 (docs/2026-05-18-mui-redesign-plan.md):
//   - primary = #1A73E8 (블루)
//   - light mode only
//   - card radius 12px, button radius 6px, table radius 무
//   - dark sidebar gradient #42424a → #191919 (StatCard/Sidebar 직접 사용; theme 색상 아님)

import { createTheme } from "@mui/material/styles";
import { tokens, gradients } from "./tokens";

// tokens / gradients 는 ./tokens.ts (server-safe) 에 정의됨.
// 이 파일은 "use client" 이므로 RSC 가 dot 접근을 막음 — 서버 컴포넌트(StatCard 등)는
// 반드시 ./tokens 에서 직접 import 해야 함.
export { tokens, gradients };

// 그림자 — Material Dashboard React xl/xxl approximation
const SHADOW_XL =
  "0 23px 45px -11px rgba(0,0,0,0.25)";
const SHADOW_CARD =
  "0 4px 6px -1px rgba(0,0,0,0.08), 0 2px 4px -1px rgba(0,0,0,0.06)";

export const theme = createTheme({
  palette: {
    mode: "light",
    primary: tokens.primary,
    secondary: tokens.secondary,
    info: tokens.info,
    success: tokens.success,
    warning: tokens.warning,
    error: tokens.error,
    text: tokens.text,
    background: tokens.background,
    divider: "#f0f2f5",
  },
  shape: { borderRadius: 6 },
  typography: {
    fontFamily:
      'var(--font-roboto), var(--font-noto-sans-kr), -apple-system, BlinkMacSystemFont, "Segoe UI", "Apple SD Gothic Neo", "Pretendard", Roboto, sans-serif',
    h1: { fontSize: "3rem", fontWeight: 700, lineHeight: 1.25, color: tokens.text.primary },
    h2: { fontSize: "2.25rem", fontWeight: 700, lineHeight: 1.3, color: tokens.text.primary },
    h3: { fontSize: "1.875rem", fontWeight: 700, lineHeight: 1.375, color: tokens.text.primary },
    h4: { fontSize: "1.5rem", fontWeight: 700, lineHeight: 1.375, color: tokens.text.primary },
    h5: { fontSize: "1.25rem", fontWeight: 600, lineHeight: 1.375, color: tokens.text.primary },
    h6: { fontSize: "1rem", fontWeight: 600, lineHeight: 1.625, color: tokens.text.primary },
    body1: { fontSize: "1rem", lineHeight: 1.625, color: tokens.text.primary },
    body2: { fontSize: "0.875rem", lineHeight: 1.6, color: tokens.text.primary },
    caption: { fontSize: "0.75rem", lineHeight: 1.5, color: tokens.text.secondary },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: tokens.background.default,
          WebkitFontSmoothing: "antialiased",
          MozOsxFontSmoothing: "grayscale",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: SHADOW_CARD,
          overflow: "visible",
          backgroundColor: tokens.background.paper,
        },
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        root: { padding: "16px 20px 0" },
        title: { fontSize: "1.0625rem", fontWeight: 600, color: tokens.text.primary },
        subheader: { fontSize: "0.8125rem", color: tokens.text.secondary, marginTop: 2 },
      },
    },
    MuiCardContent: {
      styleOverrides: {
        root: {
          padding: "16px 20px",
          "&:last-child": { paddingBottom: 16 },
        },
      },
    },
    MuiAppBar: {
      defaultProps: { elevation: 0, color: "transparent" },
      styleOverrides: { root: { boxShadow: "none", backgroundColor: "transparent" } },
    },
    MuiButton: {
      defaultProps: { disableElevation: false, variant: "contained" },
      styleOverrides: {
        root: {
          borderRadius: 6,
          textTransform: "none",
          fontWeight: 600,
          minHeight: 40,
          padding: "8px 16px",
          boxShadow: "none",
          "&:hover": { boxShadow: "none" },
        },
        sizeSmall: { minHeight: 32, padding: "4px 12px", fontSize: "0.8125rem" },
        containedPrimary: {
          background: `linear-gradient(195deg, ${gradients.primary.from}, ${gradients.primary.to})`,
          color: "#ffffff",
        },
        containedSecondary: {
          background: `linear-gradient(195deg, ${tokens.secondary.light}, ${tokens.secondary.dark})`,
          color: "#ffffff",
        },
        containedError: {
          background: `linear-gradient(195deg, ${gradients.error.from}, ${gradients.error.to})`,
          color: "#ffffff",
        },
        containedSuccess: {
          background: `linear-gradient(195deg, ${gradients.success.from}, ${gradients.success.to})`,
          color: "#ffffff",
        },
        containedWarning: {
          background: `linear-gradient(195deg, ${gradients.warning.from}, ${gradients.warning.to})`,
          color: "#ffffff",
        },
      },
    },
    MuiIconButton: {
      styleOverrides: { root: { borderRadius: 6 } },
    },
    MuiTable: {
      styleOverrides: { root: { borderCollapse: "separate", borderSpacing: 0 } },
    },
    MuiTableHead: {
      styleOverrides: {
        root: {
          "& .MuiTableCell-head": {
            color: tokens.text.secondary,
            fontWeight: 700,
            fontSize: "0.6875rem",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            backgroundColor: "transparent",
            borderBottom: "1px solid #f0f2f5",
          },
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        root: {
          borderBottom: "1px solid #f0f2f5",
          padding: "12px 16px",
          fontSize: "0.875rem",
          color: tokens.text.primary,
        },
        sizeSmall: { padding: "8px 12px", fontSize: "0.8125rem" },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:last-child td": { borderBottom: 0 },
          "&:hover td": { backgroundColor: "rgba(26,115,232,0.04)" },
        },
      },
    },
    MuiTableContainer: {
      styleOverrides: {
        root: { boxShadow: "none", borderRadius: 0, backgroundColor: "transparent" },
      },
    },
    MuiTextField: {
      defaultProps: { variant: "outlined", size: "small" },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          fontSize: "0.875rem",
          backgroundColor: "#ffffff",
        },
      },
    },
    MuiInputLabel: {
      styleOverrides: { root: { fontSize: "0.875rem" } },
    },
    MuiSelect: {
      defaultProps: { size: "small" },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, fontSize: "0.75rem", height: 24 },
        sizeSmall: { fontSize: "0.6875rem", height: 22 },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { borderRadius: 8, fontSize: "0.875rem" },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          minHeight: 40,
          "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          minHeight: 40,
          fontSize: "0.875rem",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: { borderRadius: 12, boxShadow: SHADOW_XL },
      },
    },
    MuiDialogTitle: {
      styleOverrides: { root: { fontWeight: 600, fontSize: "1.125rem" } },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: { borderRadius: 6 },
      },
    },
    MuiDivider: {
      styleOverrides: { root: { borderColor: "#f0f2f5" } },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: { fontSize: "0.75rem", borderRadius: 4 },
      },
    },
    MuiAccordion: {
      styleOverrides: {
        root: {
          boxShadow: "none",
          backgroundColor: "transparent",
          "&:before": { display: "none" },
        },
      },
    },
  },
});

export type IconiaTheme = typeof theme;
