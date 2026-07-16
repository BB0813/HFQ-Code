import { useState } from "react";
import { AIChatBubble, AIPromptBox, AISuggestionCard } from "@/components/ai";
import { PageHeader } from "@/components/shell/DesktopWindow";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const SESSIONS = [
  { id: "1", title: "Harden login flow", time: "12m" },
  { id: "2", title: "PTY terminal design", time: "1h" },
  { id: "3", title: "Skill store polish", time: "Yesterday" },
];

export function ChatScreen() {
  const [active, setActive] = useState("1");
  const [prompt, setPrompt] = useState("");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="AI Chat" description="Conversations with workspace context" />
      <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)_280px] gap-0 overflow-hidden rounded-lg border border-hfq-border">
        <div className="overflow-auto border-r border-hfq-border bg-hfq-bg-secondary p-2">
          {SESSIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              className={cn(
                "mb-1 w-full rounded-md px-2.5 py-2 text-left",
                active === s.id
                  ? "bg-[rgba(34,211,238,0.1)] text-hfq-brand-cyan"
                  : "text-hfq-text-muted hover:bg-hfq-bg-surface",
              )}
            >
              <div className="truncate text-[13px] font-medium">{s.title}</div>
              <div className="text-[11px] text-hfq-text-disabled">{s.time}</div>
            </button>
          ))}
        </div>
        <div className="flex min-h-0 flex-col gap-3 overflow-auto bg-hfq-bg-primary p-4">
          <AIChatBubble role="user">Can you summarize open risks in the desktop shell?</AIChatBubble>
          <AIChatBubble role="assistant" meta="gpt-4.1-mini">
            Highest risk is the remaining handlers in <code className="font-mono">app.js</code>. R1
            split pages; next slice is keyboard focus + terminal IPC. I can draft a checklist.
          </AIChatBubble>
          <div className="mt-auto">
            <AIPromptBox value={prompt} onChange={setPrompt} onSend={() => setPrompt("")} />
          </div>
        </div>
        <div className="space-y-3 overflow-auto border-l border-hfq-border bg-hfq-bg-secondary p-3">
          <Card soft className="text-[12px] text-hfq-text-muted">
            <div className="mb-1 font-semibold text-hfq-text-secondary">Session actions</div>
            Export · Pin · Clear context
          </Card>
          <AISuggestionCard
            title="Extract bindHandlers"
            body="Move remaining event binders out of app.js into pages/*-handlers.js without behavior change."
          />
        </div>
      </div>
    </div>
  );
}
