import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge, type BadgeTone } from "./Badge";

export function Card({
  elevated,
  soft,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { elevated?: boolean; soft?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-hfq-border bg-hfq-bg-secondary p-4",
        soft && "bg-hfq-bg-surface",
        elevated && "bg-gradient-to-b from-[#121824] to-hfq-bg-secondary",
        className,
      )}
      {...props}
    />
  );
}

export function ProjectCard({
  title,
  path,
  status,
  statusTone = "cyan",
  running,
  metrics,
  className,
}: {
  title: string;
  path: string;
  status: string;
  statusTone?: BadgeTone;
  running?: boolean;
  metrics: { label: string; value: string; sub: string }[];
  className?: string;
}) {
  return (
    <Card
      elevated
      className={cn(
        "relative overflow-hidden before:absolute before:inset-y-0 before:left-0 before:w-[3px] before:bg-hfq-brand-cyan before:opacity-85",
        running && "before:bg-hfq-success",
        className,
      )}
    >
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-[15px] font-semibold tracking-tight">{title}</h3>
          <div className="mt-1 font-mono text-[11px] text-hfq-text-disabled">{path}</div>
        </div>
        <Badge tone={statusTone}>{status}</Badge>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {metrics.map((m) => (
          <Metric key={m.label} {...m} />
        ))}
      </div>
    </Card>
  );
}

export function Metric({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] tracking-wide text-hfq-text-disabled">{label}</span>
      <span className="text-[22px] font-semibold tracking-tight tabular-nums">{value}</span>
      {sub && <span className="font-mono text-[11px] text-hfq-text-muted">{sub}</span>}
    </div>
  );
}

export function MetricCard({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  className?: string;
}) {
  return (
    <Card className={className}>
      <Metric label={label} value={value} sub={sub} />
    </Card>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2.5 text-small font-semibold tracking-wide text-hfq-text-secondary">
      {children}
    </div>
  );
}

export function ListRow({
  icon,
  title,
  subtitle,
  trailing,
  onClick,
  className,
}: {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-1 py-2.5 transition-colors",
        onClick && "cursor-pointer hover:bg-hfq-bg-surface",
        className,
      )}
    >
      {icon}
      <div className="min-w-0 flex-1">
        <strong className="block text-[13px] font-semibold">{title}</strong>
        {subtitle && (
          <span className="block truncate text-[12px] text-hfq-text-muted">{subtitle}</span>
        )}
      </div>
      {trailing}
    </div>
  );
}
