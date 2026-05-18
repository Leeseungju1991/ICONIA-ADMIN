// Pure-data design tokens — JSON-serializable constants only.
// theme.ts ("use client") imports from here so MUI ThemeProvider receives a real theme on the client,
// while server components (e.g. StatCard rendered inside the dashboard server tree) can also import
// these tokens directly without dotting into a client module (which RSC forbids).

export const tokens = {
  primary: { main: "#1A73E8", light: "#49a3f1", dark: "#1A73E8" },
  secondary: { main: "#7b809a", light: "#8f93a9", dark: "#6c707f" },
  info: { main: "#4FC3F7", light: "#80d6fb", dark: "#039be5" },
  success: { main: "#4CAF50", light: "#66bb6a", dark: "#43a047" },
  warning: { main: "#fb8c00", light: "#ffa726", dark: "#f57c00" },
  error: { main: "#F44335", light: "#ef5350", dark: "#e53935" },
  dark: { main: "#344767", gradientFrom: "#42424a", gradientTo: "#191919" },
  light: { main: "#f0f2f5" },
  text: { primary: "#344767", secondary: "#7b809a" },
  background: { default: "#f0f2f5", paper: "#ffffff" },
} as const;

export const gradients = {
  primary: { from: "#49a3f1", to: "#1A73E8" },
  info: { from: "#49a3f1", to: "#1A73E8" },
  success: { from: "#66BB6A", to: "#43A047" },
  warning: { from: "#FFA726", to: "#FB8C00" },
  error: { from: "#EF5350", to: "#E53935" },
  dark: { from: "#42424a", to: "#191919" },
} as const;
