import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { IconLoader } from "@/icons";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "outline"
  | "danger"
  | "ai"
  | "violet";

export type ButtonSize = "sm" | "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-hfq-brand-cyan text-[var(--hfq-cyan-ink)] border-transparent font-semibold hover:bg-[var(--hfq-cyan-hover)]",
  secondary:
    "bg-hfq-bg-surface text-hfq-text-secondary border-hfq-border hover:bg-hfq-bg-elevated hover:text-hfq-text-primary hover:border-hfq-border-strong",
  ghost:
    "bg-transparent border-transparent text-hfq-text-muted hover:bg-hfq-bg-surface hover:text-hfq-text-primary hover:border-hfq-border",
  outline:
    "bg-transparent text-hfq-text-secondary border-hfq-border hover:bg-hfq-bg-surface hover:text-hfq-text-primary",
  danger:
    "bg-[var(--hfq-error-soft)] text-[#fda4af] border-[rgba(244,63,94,0.25)] hover:bg-[rgba(244,63,94,0.18)]",
  ai: "bg-hfq-brand-purple text-white border-transparent hover:bg-[#a78bfa]",
  violet:
    "bg-hfq-brand-purple text-white border-transparent hover:bg-[#a78bfa]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-[30px] px-2.5 text-small rounded-[7px] gap-1.5",
  md: "h-9 px-3.5 text-body gap-2 rounded-md",
  lg: "h-11 px-5 text-body gap-2 rounded-lg",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading,
  disabled,
  leftIcon,
  rightIcon,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center border font-medium whitespace-nowrap transition-all duration-160 ease-hfq active:scale-[0.98] disabled:opacity-45 disabled:pointer-events-none",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading ? <IconLoader size={14} /> : leftIcon}
      {children}
      {!loading && rightIcon}
    </button>
  );
}

export function IconButton({
  className,
  active,
  ai,
  badge,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  active?: boolean;
  ai?: boolean;
  badge?: boolean;
}) {
  return (
    <button
      type="button"
      className={cn(
        "relative grid h-8 w-8 place-items-center rounded-md border border-transparent text-hfq-text-muted transition-all duration-160 ease-hfq",
        "hover:bg-hfq-bg-elevated hover:text-hfq-text-primary hover:border-hfq-border",
        ai &&
          "text-hfq-brand-purple bg-[var(--hfq-violet-soft)] border-[rgba(139,92,246,0.25)] hover:bg-[rgba(139,92,246,0.22)] hover:text-[#c4b5fd]",
        active && "bg-hfq-bg-elevated text-hfq-text-primary border-hfq-border",
        className,
      )}
      {...props}
    >
      {children}
      {badge && (
        <span className="absolute right-[5px] top-[5px] h-[7px] w-[7px] rounded-full bg-hfq-brand-cyan shadow-[0_0_0_2px_var(--hfq-bg-secondary)]" />
      )}
    </button>
  );
}
