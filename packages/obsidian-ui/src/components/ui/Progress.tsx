import { cn } from "@/lib/cn";

export function ProgressBar({
  value,
  max = 100,
  tone = "cyan",
  className,
}: {
  value: number;
  max?: number;
  tone?: "cyan" | "ok" | "warn" | "danger" | "violet";
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100));
  const bar: Record<string, string> = {
    cyan: "bg-hfq-brand-cyan",
    ok: "bg-hfq-success",
    warn: "bg-hfq-warning",
    danger: "bg-hfq-error",
    violet: "bg-hfq-brand-purple",
  };
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-hfq-bg-elevated", className)}>
      <div className={cn("h-full rounded-full transition-all", bar[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-hfq-bg-elevated",
        className,
      )}
    />
  );
}
