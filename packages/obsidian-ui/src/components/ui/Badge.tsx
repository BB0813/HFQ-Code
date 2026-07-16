import type { HTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export type BadgeTone = "default" | "ok" | "warn" | "cyan" | "violet" | "danger";

const tones: Record<BadgeTone, string> = {
  default: "text-hfq-text-muted bg-hfq-bg-surface border-hfq-border",
  ok: "text-hfq-success bg-[var(--hfq-success-soft)] border-[rgba(34,197,94,0.25)]",
  warn: "text-hfq-warning bg-[var(--hfq-warning-soft)] border-[rgba(245,158,11,0.25)]",
  cyan: "text-hfq-brand-cyan bg-[var(--hfq-cyan-soft)] border-[rgba(34,211,238,0.25)]",
  violet: "text-[#c4b5fd] bg-[var(--hfq-violet-soft)] border-[rgba(139,92,246,0.28)]",
  danger: "text-[#fda4af] bg-[var(--hfq-error-soft)] border-[rgba(244,63,94,0.25)]",
};

export function Badge({
  tone = "default",
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-[11px]",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

export function Tag({
  className,
  ...props
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-hfq-border bg-hfq-bg-surface px-2 py-0.5 text-[11px] text-hfq-text-muted",
        className,
      )}
      {...props}
    />
  );
}
