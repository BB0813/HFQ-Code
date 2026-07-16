import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./Button";

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className,
      )}
    >
      {icon && (
        <div className="grid h-12 w-12 place-items-center rounded-xl border border-hfq-border bg-hfq-bg-surface text-hfq-text-muted">
          {icon}
        </div>
      )}
      <div>
        <h3 className="m-0 text-h3 text-hfq-text-primary">{title}</h3>
        {description && (
          <p className="mt-1.5 max-w-sm text-small text-hfq-text-muted">{description}</p>
        )}
      </div>
      {actionLabel && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
