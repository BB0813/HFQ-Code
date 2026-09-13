import type { ReactNode } from "react";
import { Loader2, RefreshCw, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Shared destructive/confirm dialog — replaces native window.confirm across pages. */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = "确认",
  destructive,
  onConfirm,
  onOpenChange,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmText?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription className="whitespace-pre-wrap">{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            size="sm"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ErrorBanner({
  message,
  onRetry,
  className,
}: {
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className={cn(
        "mb-4 flex items-start gap-2.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 text-sm text-destructive",
        className,
      )}
    >
      <span className="min-w-0 flex-1 selectable whitespace-pre-wrap">{message}</span>
      {onRetry && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 shrink-0 border-destructive/30 text-destructive hover:bg-destructive/10"
          onClick={onRetry}
        >
          重试
        </Button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl px-5 py-10 text-center",
        className,
      )}
    >
      {Icon && (
        <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-muted/50">
          <Icon className="h-[18px] w-[18px] text-muted-foreground" strokeWidth={1.5} />
        </div>
      )}
      <div className="text-sm font-medium text-foreground/85">{title}</div>
      {description && (
        <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground text-balance">
          {description}
        </p>
      )}
      {action && <div className="mt-3 flex flex-wrap items-center justify-center gap-2">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = "加载中…", className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-2.5 py-14 text-sm text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

export function SectionHeader({
  title,
  count,
  action,
  className,
}: {
  title: string;
  count?: number;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2.5 flex items-center justify-between gap-2", className)}>
      <div className="flex items-center gap-2">
        <span className="section-label">{title}</span>
        {typeof count === "number" && (
          <span className="text-xs tabular-nums text-muted-foreground/60">{count}</span>
        )}
      </div>
      {action}
    </div>
  );
}

export function RefreshButton({
  onClick,
  loading,
  label = "刷新",
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}) {
  return (
    <Button
      size="sm"
      variant="secondary"
      disabled={loading}
      onClick={onClick}
      aria-label={label}
    >
      <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
      {label}
    </Button>
  );
}

export function ChipButton({
  active,
  disabled,
  onClick,
  children,
  className,
  title,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={cn(
        "interactive rounded-md border px-3 py-1.5 text-sm transition-colors duration-150",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? "border-workbench/40 bg-workbench/15 text-foreground shadow-sm ring-1 ring-workbench/20"
          : "border-border/80 bg-transparent text-muted-foreground hover:border-border hover:bg-muted/50 hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Summary metric strip — multi-agent workbench density */
export function MetricStrip({
  items,
  className,
}: {
  items: { label: string; value: string | number; hint?: string }[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className={cn(
        "metric-strip",
        items.length === 3 && "sm:grid-cols-3",
        items.length === 2 && "sm:grid-cols-2",
        items.length === 1 && "sm:grid-cols-1",
        className,
      )}
    >
      {items.map((it) => (
        <div key={it.label} className="metric-tile" title={it.hint}>
          <div className="metric-tile-label">{it.label}</div>
          <div className="metric-tile-value">{it.value}</div>
        </div>
      ))}
    </div>
  );
}

/** Capability-style row/card for skills, MCP, models */
export function CapabilityCard({
  title,
  description,
  status,
  tags,
  badges,
  trailing,
  className,
}: {
  title: string;
  description?: string;
  status?: "running" | "idle" | "warn" | "off";
  tags?: string[];
  badges?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}) {
  const dot =
    status === "running"
      ? "status-dot-running"
      : status === "warn"
        ? "status-dot-warn"
        : status === "off"
          ? "status-dot-idle opacity-30"
          : "status-dot-idle";

  return (
    <div className={cn("capability-card p-3", className)}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {status != null && <span className={dot} aria-hidden />}
            <span className="truncate text-sm font-semibold tracking-tight text-foreground/95">
              {title}
            </span>
            {badges}
          </div>
          {description && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
          {tags && tags.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1">
              {tags.map((t) => (
                <span key={t} className="capability-tag">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
      </div>
    </div>
  );
}
