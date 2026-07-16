import type { InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  leftSlot?: ReactNode;
  rightSlot?: ReactNode;
}

export function Input({
  className,
  error,
  leftSlot,
  rightSlot,
  disabled,
  ...props
}: InputProps) {
  return (
    <div
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-md border bg-black/30 px-3 transition-all duration-160 ease-hfq",
        "border-hfq-border focus-within:border-[rgba(34,211,238,0.45)] focus-within:shadow-focus",
        error && "border-[rgba(239,68,68,0.5)] focus-within:border-hfq-error focus-within:shadow-[0_0_0_3px_rgba(239,68,68,0.2)]",
        disabled && "opacity-50 pointer-events-none",
        className,
      )}
    >
      {leftSlot && <span className="text-hfq-text-muted">{leftSlot}</span>}
      <input
        disabled={disabled}
        className="min-w-0 flex-1 bg-transparent text-hfq-text-primary outline-none placeholder:text-hfq-text-muted"
        {...props}
      />
      {rightSlot && <span className="text-hfq-text-muted">{rightSlot}</span>}
    </div>
  );
}

export function Textarea({
  className,
  error,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }) {
  return (
    <textarea
      className={cn(
        "min-h-[88px] w-full resize-y rounded-md border border-hfq-border bg-black/30 px-3 py-2.5 text-hfq-text-primary outline-none transition-all duration-160 ease-hfq",
        "placeholder:text-hfq-text-muted focus:border-[rgba(34,211,238,0.45)] focus:shadow-focus",
        error && "border-[rgba(239,68,68,0.5)]",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  help,
  children,
  className,
}: {
  label?: string;
  help?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <span className="text-small font-medium text-hfq-text-secondary">{label}</span>
      )}
      {children}
      {help && <span className="text-[11px] text-hfq-text-disabled">{help}</span>}
    </label>
  );
}

export function SearchInput({
  className,
  ...props
}: InputProps) {
  return (
    <Input
      className={className}
      leftSlot={
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      }
      placeholder="Search…"
      {...props}
    />
  );
}
