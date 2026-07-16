import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/Button";
import { IconClose, IconSearch } from "@/icons";

export function Modal({
  open,
  title,
  children,
  onClose,
  footer,
  className,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose?: () => void;
  footer?: ReactNode;
  className?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6">
      <div
        className={cn(
          "w-full max-w-lg overflow-hidden rounded-xl border border-hfq-border bg-hfq-bg-secondary shadow-float",
          className,
        )}
      >
        <div className="flex items-center justify-between border-b border-hfq-border px-4 py-3">
          <h2 className="m-0 text-h3">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-md text-hfq-text-muted hover:bg-hfq-bg-elevated"
          >
            <IconClose size={16} />
          </button>
        </div>
        <div className="px-4 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-hfq-border px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommandPalette({
  open,
  query,
  onQueryChange,
  items,
  onSelect,
  onClose,
}: {
  open: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  items: { id: string; label: string; hint?: string }[];
  onSelect?: (id: string) => void;
  onClose?: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-start bg-black/55 pt-[12vh]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border border-hfq-border bg-hfq-bg-secondary shadow-float"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-hfq-border px-3 py-3">
          <IconSearch size={16} className="text-hfq-text-muted" />
          <input
            autoFocus
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder="Type a command or search…"
            className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-hfq-text-muted"
          />
          <kbd className="rounded border border-hfq-border px-1.5 py-0.5 font-mono text-[10px] text-hfq-text-disabled">
            ESC
          </kbd>
        </div>
        <div className="max-h-80 overflow-auto p-1.5">
          {items.length === 0 && (
            <div className="px-3 py-6 text-center text-small text-hfq-text-muted">
              No results
            </div>
          )}
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onSelect?.(it.id)}
              className="flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left hover:bg-hfq-bg-elevated"
            >
              <span className="text-[13px]">{it.label}</span>
              {it.hint && (
                <span className="font-mono text-[11px] text-hfq-text-disabled">{it.hint}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Toast({
  open,
  tone = "default",
  title,
  description,
  onClose,
}: {
  open: boolean;
  tone?: "default" | "ok" | "warn" | "danger";
  title: string;
  description?: string;
  onClose?: () => void;
}) {
  if (!open) return null;
  const border = {
    default: "border-hfq-border",
    ok: "border-[rgba(34,197,94,0.35)]",
    warn: "border-[rgba(245,158,11,0.35)]",
    danger: "border-[rgba(239,68,68,0.35)]",
  }[tone];
  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 w-80 rounded-lg border bg-hfq-bg-elevated p-3 shadow-float",
        border,
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold">{title}</div>
          {description && (
            <div className="mt-0.5 text-[12px] text-hfq-text-muted">{description}</div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>
          ×
        </Button>
      </div>
    </div>
  );
}

export function Tooltip({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-md border border-hfq-border bg-hfq-bg-elevated px-2 py-1 text-[11px] text-hfq-text-secondary opacity-0 shadow transition-opacity group-hover:opacity-100">
        {label}
      </span>
    </span>
  );
}
