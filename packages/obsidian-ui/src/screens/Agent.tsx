import { useState } from "react";
import {
  AIAgentStatus,
  AIApprovalDialog,
  AIChatBubble,
  AIDiffViewer,
  AIModelSelector,
  AIPromptBox,
  AITaskCard,
  AIThinkingIndicator,
} from "@/components/ai";
import { PageHeader } from "@/components/shell/DesktopWindow";
import { Card, SectionTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function AgentScreen() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("gpt-4.1-mini");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader
        title="AI Agent"
        description="Plan · execute · review with workspace tools"
        actions={
          <>
            <AIModelSelector
              models={["gpt-4.1-mini", "gpt-4.1", "claude-sonnet", "local-qwen"]}
              value={model}
              onChange={setModel}
            />
            <AIAgentStatus state="planning" label="Planning" />
          </>
        }
      />

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-4">
        <div className="flex min-h-0 flex-col gap-3 overflow-auto">
          <div className="space-y-3">
            <AIChatBubble role="user" meta="just now">
              Harden the login flow: rotate session tokens, reject path escapes in tools, and add regression tests.
            </AIChatBubble>
            <AIChatBubble role="assistant" meta={model}>
              I&apos;ll inspect <code className="font-mono text-hfq-brand-cyan">session-api</code> and{" "}
              <code className="font-mono text-hfq-brand-cyan">policy</code>, then propose a minimal patch set.
            </AIChatBubble>
            <AIThinkingIndicator label="Reading packages/policy · mapping tool scopes…" />
          </div>

          <AIDiffViewer
            file="packages/session-api/src/tokens.ts"
            lines={[
              { type: "ctx", text: "export function issueToken(userId: string) {" },
              { type: "del", text: "  return jwt.sign({ userId }, SECRET);" },
              { type: "add", text: "  return jwt.sign({ userId, jti: randomUUID() }, SECRET, {" },
              { type: "add", text: "    expiresIn: '1h'," },
              { type: "add", text: "  });" },
              { type: "ctx", text: "}" },
            ]}
          />

          <AIPromptBox value={prompt} onChange={setPrompt} onSend={() => setPrompt("")} />
        </div>

        <div className="flex min-h-0 flex-col gap-3 overflow-auto">
          <AITaskCard
            title="Harden login flow"
            step={2}
            total={4}
            state="planning"
            detail="Token rotation · path policy · tests"
          />
          <Card>
            <SectionTitle>Context</SectionTitle>
            <ul className="m-0 list-none space-y-1.5 p-0 font-mono text-[11px] text-hfq-text-muted">
              <li>@file packages/session-api</li>
              <li>@file packages/policy</li>
              <li>@git main…origin/main</li>
              <li>@skill auth-hardening</li>
            </ul>
          </Card>
          <AIApprovalDialog
            title="Write packages/session-api/src/tokens.ts"
            description="Agent requests write access outside the soft allowlist for this turn."
          />
          <div className="flex gap-2">
            <Button variant="primary" size="sm" className="flex-1">
              Continue
            </Button>
            <Button variant="danger" size="sm">
              Stop
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
