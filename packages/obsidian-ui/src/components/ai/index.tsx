import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/Progress";
import { IconBot, IconSpark, IconLoader, IconCheck } from "@/icons";

export type AgentState =
  | "idle"
  | "thinking"
  | "planning"
  | "executing"
  | "completed"
  | "error";

const stateTone: Record<AgentState, "default" | "cyan" | "violet" | "ok" | "danger" | "warn"> = {
  idle: "default",
  thinking: "violet",
  planning: "cyan",
  executing: "ok",
  completed: "ok",
  error: "danger",
};

export function AICommandBar({
  placeholder = "Ask HFQ AI anything…",
  onSubmit,
  onRunAgent,
}: {
  placeholder?: string;
  onSubmit?: (v: string) => void;
  onRunAgent?: () => void;
}) {
  return (
    <div className="mb-[18px] flex items-center gap-2 rounded-lg border border-hfq-border bg-hfq-bg-secondary px-2 py-2">
      <IconSpark size={18} className="ml-1.5 text-hfq-brand-purple" />
      <input
        className="min-w-0 flex-1 bg-transparent px-2 text-[13px] outline-none placeholder:text-hfq-text-muted"
        placeholder={placeholder}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit?.((e.target as HTMLInputElement).value);
        }}
      />
      <Button variant="primary" size="sm" onClick={onRunAgent}>
        Run agent
      </Button>
    </div>
  );
}

export function AIPromptBox({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend?: () => void;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-hfq-border bg-black/30 p-3 focus-within:border-[rgba(34,211,238,0.45)] focus-within:shadow-focus">
      <textarea
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Describe a goal, paste an error, or ask for a refactor…"
        className="w-full resize-none bg-transparent text-[13px] outline-none placeholder:text-hfq-text-muted"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[11px] text-hfq-text-disabled">@context · /skills</span>
        <Button variant="ai" size="sm" onClick={onSend} disabled={disabled || !value.trim()}>
          <IconSpark size={14} /> Send
        </Button>
      </div>
    </div>
  );
}

export function AIChatBubble({
  role,
  children,
  meta,
}: {
  role: "user" | "assistant" | "system";
  children: ReactNode;
  meta?: string;
}) {
  const isUser = role === "user";
  return (
    <div className={cn("flex gap-2.5", isUser && "flex-row-reverse")}>
      <div
        className={cn(
          "grid h-7 w-7 shrink-0 place-items-center rounded-md border text-[11px] font-semibold",
          isUser
            ? "border-hfq-border bg-hfq-bg-elevated text-hfq-text-secondary"
            : "border-[rgba(139,92,246,0.3)] bg-[var(--hfq-violet-soft)] text-hfq-brand-purple",
        )}
      >
        {isUser ? "U" : <IconBot size={14} />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-lg border px-3 py-2.5 text-[13px] leading-relaxed",
          isUser
            ? "border-hfq-border bg-hfq-bg-surface"
            : "border-[rgba(139,92,246,0.18)] bg-gradient-to-b from-[rgba(139,92,246,0.08)] to-hfq-bg-secondary",
        )}
      >
        {children}
        {meta && (
          <div className="mt-1.5 font-mono text-[10px] text-hfq-text-disabled">{meta}</div>
        )}
      </div>
    </div>
  );
}

export function AIThinkingIndicator({ label = "Thinking…" }: { label?: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(139,92,246,0.25)] bg-[var(--hfq-violet-soft)] px-3 py-1.5 text-[12px] text-[#c4b5fd]">
      <IconLoader size={14} />
      {label}
    </div>
  );
}

export function AIAgentStatus({
  state,
  label,
}: {
  state: AgentState;
  label?: string;
}) {
  return (
    <Badge tone={stateTone[state]}>
      {state === "executing" || state === "thinking" ? (
        <IconLoader size={12} />
      ) : state === "completed" ? (
        <IconCheck size={12} />
      ) : null}
      {label ?? state}
    </Badge>
  );
}

export function AITaskCard({
  title,
  step,
  total,
  state,
  detail,
}: {
  title: string;
  step: number;
  total: number;
  state: AgentState;
  detail?: string;
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="m-0 text-[14px] font-semibold">{title}</h3>
          {detail && <p className="mt-1 text-[12px] text-hfq-text-muted">{detail}</p>}
        </div>
        <AIAgentStatus state={state} />
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between font-mono text-[11px] text-hfq-text-disabled">
          <span>
            Step {step}/{total}
          </span>
          <span>{Math.round((step / total) * 100)}%</span>
        </div>
        <ProgressBar value={step} max={total} tone={state === "error" ? "danger" : "violet"} />
      </div>
    </Card>
  );
}

export function AISuggestionCard({
  title,
  body,
  onApply,
  onDismiss,
}: {
  title: string;
  body: string;
  onApply?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <Card className="border-[rgba(34,211,238,0.18)] bg-gradient-to-br from-[rgba(34,211,238,0.06)] to-hfq-bg-secondary">
      <div className="mb-2 flex items-center gap-2 text-hfq-brand-cyan">
        <IconSpark size={14} />
        <span className="text-[12px] font-semibold">AI suggestion</span>
      </div>
      <h4 className="m-0 text-[13px] font-semibold">{title}</h4>
      <p className="mt-1 text-[12px] text-hfq-text-muted">{body}</p>
      <div className="mt-3 flex gap-2">
        <Button variant="primary" size="sm" onClick={onApply}>
          Apply
        </Button>
        <Button variant="ghost" size="sm" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </Card>
  );
}

export function AIDiffViewer({
  file,
  lines,
}: {
  file: string;
  lines: { type: "ctx" | "add" | "del"; text: string }[];
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-hfq-border bg-[#0a0e14]">
      <div className="border-b border-hfq-border px-3 py-2 font-mono text-[11px] text-hfq-text-muted">
        {file}
      </div>
      <pre className="overflow-auto p-0 font-mono text-[12px] leading-5">
        {lines.map((l, i) => (
          <div
            key={i}
            className={cn(
              "px-3",
              l.type === "add" && "bg-[rgba(34,197,94,0.12)] text-emerald-300",
              l.type === "del" && "bg-[rgba(239,68,68,0.12)] text-rose-300",
              l.type === "ctx" && "text-hfq-text-muted",
            )}
          >
            <span className="mr-3 inline-block w-3 select-none opacity-60">
              {l.type === "add" ? "+" : l.type === "del" ? "-" : " "}
            </span>
            {l.text}
          </div>
        ))}
      </pre>
    </div>
  );
}

export function AIModelSelector({
  models,
  value,
  onChange,
}: {
  models: string[];
  value: string;
  onChange: (m: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-md border border-hfq-border bg-hfq-bg-surface px-2.5 text-[13px] text-hfq-text-secondary outline-none focus:border-[rgba(34,211,238,0.45)]"
    >
      {models.map((m) => (
        <option key={m} value={m}>
          {m}
        </option>
      ))}
    </select>
  );
}

export function AIApprovalDialog({
  title,
  description,
  onAllow,
  onDeny,
}: {
  title: string;
  description: string;
  onAllow?: () => void;
  onDeny?: () => void;
}) {
  return (
    <Card className="max-w-md border-[rgba(245,158,11,0.3)]">
      <h3 className="m-0 text-h3">Permission required</h3>
      <p className="mt-1 text-[13px] font-semibold text-hfq-text-primary">{title}</p>
      <p className="mt-1 text-[12px] text-hfq-text-muted">{description}</p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onDeny}>
          Deny
        </Button>
        <Button variant="primary" size="sm" onClick={onAllow}>
          Allow once
        </Button>
      </div>
    </Card>
  );
}
