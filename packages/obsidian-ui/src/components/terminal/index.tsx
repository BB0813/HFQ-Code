import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";

export type TerminalRunState = "running" | "success" | "failed";

export function TerminalWindow({
  title = "powershell",
  lines,
  state = "running",
  cwd = "D:\\work\\project-beta",
}: {
  title?: string;
  lines: { kind: "cmd" | "out" | "err"; text: string }[];
  state?: TerminalRunState;
  cwd?: string;
}) {
  return (
    <div className="flex h-full min-h-[220px] flex-col overflow-hidden rounded-lg border border-hfq-border bg-[#070a0f]">
      <div className="flex h-9 items-center gap-2 border-b border-hfq-border bg-hfq-bg-secondary px-3">
        <span className="text-[12px] text-hfq-text-secondary">{title}</span>
        <Badge
          tone={state === "running" ? "cyan" : state === "success" ? "ok" : "danger"}
        >
          {state}
        </Badge>
        <span className="ml-auto truncate font-mono text-[11px] text-hfq-text-disabled">
          {cwd}
        </span>
      </div>
      <div className="flex-1 overflow-auto p-3 font-mono text-[12px] leading-5">
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              l.kind === "cmd" && "text-hfq-brand-cyan",
              l.kind === "out" && "text-hfq-text-secondary",
              l.kind === "err" && "text-rose-300",
            )}
          >
            {l.kind === "cmd" && <span className="mr-2 text-hfq-text-disabled">❯</span>}
            {l.text}
          </div>
        ))}
        {state === "running" && (
          <div className="mt-1 inline-block h-4 w-2 animate-pulse bg-hfq-brand-cyan/80" />
        )}
      </div>
    </div>
  );
}

export function TerminalTabs({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: { id: string; label: string }[];
  activeId: string;
  onSelect?: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-hfq-border bg-hfq-bg-secondary px-2 pt-2">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect?.(t.id)}
          className={cn(
            "h-7 rounded-t-md px-3 text-[12px]",
            t.id === activeId
              ? "bg-[#070a0f] text-hfq-text-primary"
              : "text-hfq-text-muted hover:text-hfq-text-secondary",
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
