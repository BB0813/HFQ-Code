import { cn } from "@/lib/cn";

export function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "inline-flex items-center gap-2.5 disabled:opacity-50",
      )}
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full border transition-colors",
          checked
            ? "border-[rgba(34,211,238,0.4)] bg-hfq-brand-cyan"
            : "border-hfq-border bg-hfq-bg-elevated",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
            checked ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      {label && <span className="text-small text-hfq-text-secondary">{label}</span>}
    </button>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked?: boolean;
  onChange?: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-small text-hfq-text-secondary", disabled && "opacity-50")}>
      <input
        type="checkbox"
        className="h-4 w-4 accent-hfq-brand-cyan"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      {label}
    </label>
  );
}

export function SegmentControl<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex w-fit gap-0.5 rounded-[10px] border border-hfq-border bg-hfq-bg-secondary p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "h-[30px] rounded-[7px] px-3 text-small font-medium text-hfq-text-muted transition-colors",
            "hover:bg-hfq-bg-surface hover:text-hfq-text-primary",
            value === o.value &&
              "bg-hfq-bg-elevated text-hfq-text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
