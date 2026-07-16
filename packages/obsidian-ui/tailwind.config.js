/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        hfq: {
          bg: {
            primary: "var(--hfq-bg-primary)",
            secondary: "var(--hfq-bg-secondary)",
            surface: "var(--hfq-bg-surface)",
            elevated: "var(--hfq-bg-elevated)",
            hover: "var(--hfq-bg-hover)",
          },
          text: {
            primary: "var(--hfq-text-primary)",
            secondary: "var(--hfq-text-secondary)",
            muted: "var(--hfq-text-muted)",
            disabled: "var(--hfq-text-disabled)",
          },
          brand: {
            cyan: "var(--hfq-brand-cyan)",
            blue: "var(--hfq-brand-blue)",
            purple: "var(--hfq-brand-purple)",
          },
          success: "var(--hfq-success)",
          warning: "var(--hfq-warning)",
          error: "var(--hfq-error)",
          border: {
            DEFAULT: "var(--hfq-border-default)",
            strong: "var(--hfq-border-strong)",
            focus: "var(--hfq-border-focus)",
          },
        },
      },
      fontFamily: {
        sans: ["var(--hfq-font-sans)"],
        mono: ["var(--hfq-font-mono)"],
      },
      fontSize: {
        display: ["32px", { lineHeight: "1.2", fontWeight: "700" }],
        h1: ["24px", { lineHeight: "1.25", fontWeight: "700" }],
        h2: ["20px", { lineHeight: "1.3", fontWeight: "600" }],
        h3: ["16px", { lineHeight: "1.4", fontWeight: "600" }],
        body: ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        small: ["12px", { lineHeight: "1.45", fontWeight: "400" }],
        code: ["13px", { lineHeight: "1.5", fontWeight: "400" }],
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
        16: "64px",
      },
      borderRadius: {
        sm: "6px",
        md: "8px",
        lg: "12px",
        xl: "16px",
      },
      boxShadow: {
        float: "var(--hfq-shadow-float)",
        focus: "0 0 0 3px var(--hfq-cyan-ring)",
      },
      width: {
        sidebar: "var(--hfq-sidebar-w)",
      },
      height: {
        topbar: "var(--hfq-topbar-h)",
        statusbar: "var(--hfq-statusbar-h)",
      },
      transitionDuration: {
        160: "160ms",
        240: "240ms",
      },
      transitionTimingFunction: {
        hfq: "cubic-bezier(0.2, 0.8, 0.2, 1)",
      },
      keyframes: {
        "hfq-pulse": {
          "0%": { boxShadow: "0 0 0 0 rgba(34, 197, 94, 0.45)" },
          "70%": { boxShadow: "0 0 0 8px rgba(34, 197, 94, 0)" },
          "100%": { boxShadow: "0 0 0 0 rgba(34, 197, 94, 0)" },
        },
        "hfq-fade-in": {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "none" },
        },
        "hfq-spin": {
          to: { transform: "rotate(360deg)" },
        },
      },
      animation: {
        "hfq-pulse": "hfq-pulse 2s ease infinite",
        "hfq-fade-in": "hfq-fade-in 240ms cubic-bezier(0.2, 0.8, 0.2, 1)",
        "hfq-spin": "hfq-spin 0.8s linear infinite",
      },
    },
  },
  plugins: [],
};
