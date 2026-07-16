import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type TimelineDot = "default" | "ok" | "violet" | "cyan" | "warn";

const dots: Record<TimelineDot, string> = {
  default: "bg-hfq-text-disabled",
  ok: "bg-hfq-success",
  violet: "bg-hfq-brand-purple",
  cyan: "bg-hfq-brand-cyan",
  warn: "bg-hfq-warning",
};

export function Timeline({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-col gap-0", className)}>{children}</div>;
}

export function TimelineItem({
  title,
  meta,
  tone = "default",
}: {
  title: string;
  meta: string;
  tone?: TimelineDot;
}) {
  return (
    <div className="relative flex gap-3 py-2.5 pl-1">
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dots[tone])} />
      <div className="min-w-0">
        <strong className="block text-[13px] font-semibold">{title}</strong>
        <span className="text-[12px] text-hfq-text-muted">{meta}</span>
      </div>
    </div>
  );
}
