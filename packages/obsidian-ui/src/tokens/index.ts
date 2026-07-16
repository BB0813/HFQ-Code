/**
 * Obsidian Intelligence System — design tokens
 * Source of truth: design-spec PART 3 + docs/design-proposals/hfq-v1-obsidian
 * Figma file was not readable (placeholder URL); values match the shipped prototype.
 */

export const colors = {
  background: {
    primary: "#080A0F",
    secondary: "#0D1117",
    surface: "#151B26",
    elevated: "#1B2330",
    hover: "#222B3A",
  },
  text: {
    primary: "#F8FAFC",
    secondary: "#94A3B8",
    muted: "#64748B",
    disabled: "#475569",
  },
  brand: {
    cyan: "#22D3EE",
    blue: "#3B82F6",
    purple: "#8B5CF6",
  },
  status: {
    success: "#22C55E",
    warning: "#F59E0B",
    error: "#EF4444",
  },
  border: {
    default: "rgba(255,255,255,0.08)",
    strong: "rgba(255,255,255,0.16)",
    focus: "#22D3EE",
  },
} as const;

export const spacing = {
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
  64: 64,
} as const;

export const radius = {
  small: 6,
  medium: 8,
  large: 12,
  extraLarge: 16,
} as const;

export const typography = {
  fontFamily: {
    sans: '"Inter", "Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Microsoft YaHei UI", system-ui, sans-serif',
    mono: '"JetBrains Mono", "Cascadia Code", "SF Mono", Consolas, ui-monospace, monospace',
  },
  styles: {
    display: { size: 32, weight: 700 },
    h1: { size: 24, weight: 700 },
    h2: { size: 20, weight: 600 },
    h3: { size: 16, weight: 600 },
    body: { size: 14, weight: 400 },
    small: { size: 12, weight: 400 },
    code: { size: 13, weight: 400 },
  },
} as const;

export const layout = {
  desktop: { width: 1440, height: 900 },
  topbarH: 48,
  sidebarW: 240,
  statusbarH: 28,
} as const;

export const shadows = {
  float: "0 20px 60px rgba(0, 0, 0, 0.55)",
} as const;

/** CSS custom property names for developer handoff */
export const cssVarMap = {
  "color.background.primary": "--hfq-bg-primary",
  "color.background.secondary": "--hfq-bg-secondary",
  "color.background.surface": "--hfq-bg-surface",
  "color.background.elevated": "--hfq-bg-elevated",
  "color.background.hover": "--hfq-bg-hover",
  "color.text.primary": "--hfq-text-primary",
  "color.text.secondary": "--hfq-text-secondary",
  "color.text.muted": "--hfq-text-muted",
  "color.text.disabled": "--hfq-text-disabled",
  "color.brand.cyan": "--hfq-brand-cyan",
  "color.brand.blue": "--hfq-brand-blue",
  "color.brand.purple": "--hfq-brand-purple",
  "color.status.success": "--hfq-success",
  "color.status.warning": "--hfq-warning",
  "color.status.error": "--hfq-error",
  "color.border.default": "--hfq-border-default",
  "color.border.strong": "--hfq-border-strong",
  "color.border.focus": "--hfq-border-focus",
} as const;

export type ColorToken = typeof colors;
