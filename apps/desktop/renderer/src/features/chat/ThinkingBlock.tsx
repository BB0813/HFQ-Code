import { useState } from "react";
import { Brain, ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingBlockProps {
  text: string;
  /** Live stream (not yet thinking.completed). */
  streaming?: boolean;
  /** Start expanded when streaming; completed blocks default collapsed. */
  defaultOpen?: boolean;
  className?: string;
}

/**
 * Collapsible chain-of-thought / extended thinking from agent-core
 * `thinking.delta` / `thinking.completed` (paired by messageId with assistant reply).
 */
export function ThinkingBlock({
  text,
  streaming = false,
  defaultOpen,
  className,
}: ThinkingBlockProps) {
  const openDefault = defaultOpen ?? streaming;
  const [open, setOpen] = useState(openDefault);
  const body = text.trim();
  if (!body && !streaming) return null;

  const preview =
    body.length > 120 ? `${body.slice(0, 120).replace(/\s+/g, " ")}…` : body;

  return (
    <div
      className={cn(
        "msg-thinking rounded-xl border border-border/50 px-3 py-2 text-sm",
        streaming && "ring-1 ring-workbench/20",
        className,
      )}
    >
      <button
        type="button"
        className="interactive flex w-full items-center gap-2 rounded-md px-0.5 py-0.5 text-left"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-workbench/10 text-workbench">
          {streaming ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Brain className="h-3 w-3" strokeWidth={1.75} />
          )}
        </span>
        <span className="min-w-0 flex-1 text-xs font-medium tracking-wide text-muted-foreground">
          {streaming ? "思考中…" : "思考过程"}
          {!open && body && (
            <span className="ml-2 font-normal text-muted-foreground/70">
              {preview}
            </span>
          )}
        </span>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
        )}
      </button>
      {open && (
        <div className="selectable mt-2 whitespace-pre-wrap break-words border-t border-border/40 pt-2 font-mono text-[12.5px] leading-relaxed text-muted-foreground">
          {body || (streaming ? "…" : "")}
          {streaming && (
            <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-workbench/60 align-middle" />
          )}
        </div>
      )}
    </div>
  );
}
