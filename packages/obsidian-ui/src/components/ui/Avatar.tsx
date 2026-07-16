import { cn } from "@/lib/cn";

export function Avatar({
  initials,
  size = 28,
  className,
  title,
}: {
  initials: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <div
      title={title}
      style={{ width: size, height: size }}
      className={cn(
        "grid place-items-center rounded-full border border-hfq-border-strong bg-gradient-to-br from-slate-600 to-slate-800 text-[11px] font-semibold text-hfq-text-secondary",
        className,
      )}
    >
      {initials}
    </div>
  );
}
