import { PageHeader } from "@/components/shell/DesktopWindow";
import { Card, MetricCard, SectionTitle } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { TerminalTabs, TerminalWindow } from "@/components/terminal";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { ProgressBar } from "@/components/ui/Progress";
import { IconBell, IconBug, IconFolder, IconUser } from "@/icons";
import { AISuggestionCard } from "@/components/ai";
import { ChangeFile, CommitCard } from "@/components/git";

export function ProjectsScreen() {
  return (
    <div>
      <PageHeader title="Projects" description="Open workspaces and repositories" />
      <div className="grid grid-cols-3 gap-3.5">
        <MetricCard label="Active" value="3" sub="workspaces" />
        <MetricCard label="Repos" value="12" sub="linked" />
        <MetricCard label="AI tasks" value="5" sub="running" />
      </div>
    </div>
  );
}

export function ReposScreen() {
  return (
    <div>
      <PageHeader title="Repositories" description="Local + remote sources" />
      <EmptyState
        icon={<IconFolder size={20} />}
        title="Clone or open a repository"
        description="HFQ keeps git identity per workspace and never escapes the root."
        actionLabel="Open folder"
      />
    </div>
  );
}

export function ReviewScreen() {
  return (
    <div>
      <PageHeader title="Code Review" description="Diff · AI comments · suggestions" />
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <SectionTitle>Files</SectionTitle>
          <ChangeFile path="apps/desktop/renderer/styles.css" status="M" />
          <ChangeFile path="packages/agent-core/src/history.ts" status="M" />
        </Card>
        <div className="space-y-3">
          <AISuggestionCard
            title="Reduce topbar drag region conflicts"
            body="Window controls should stay no-drag; verify Electron CSS regions after polish pass."
          />
          <AISuggestionCard
            title="Collapse long tool cards"
            body="Default to collapsed I/O for completed tool calls older than 5 minutes."
          />
        </div>
      </div>
    </div>
  );
}

export function TerminalScreen() {
  const [tab, setTab] = useState("1");
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PageHeader title="Terminal" description="Multiple sessions · logs · commands" />
      <TerminalTabs
        tabs={[
          { id: "1", label: "powershell" },
          { id: "2", label: "node" },
          { id: "3", label: "git" },
        ]}
        activeId={tab}
        onSelect={setTab}
      />
      <div className="min-h-0 flex-1">
        <TerminalWindow
          state={tab === "2" ? "failed" : "running"}
          lines={
            tab === "2"
              ? [
                  { kind: "cmd", text: "node scripts/eval.mjs" },
                  { kind: "err", text: "Error: missing fixture matrix" },
                ]
              : [
                  { kind: "cmd", text: "pnpm dev:desktop" },
                  { kind: "out", text: "Electron ready on http://localhost:5173" },
                  { kind: "out", text: "watching renderer…" },
                ]
          }
        />
      </div>
    </div>
  );
}

export function DebuggerScreen() {
  return (
    <div>
      <PageHeader title="Debugger" description="Breakpoints · variables · call stack" />
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <SectionTitle>Breakpoints</SectionTitle>
          <div className="font-mono text-[12px] text-hfq-text-muted">loop.ts:42</div>
          <div className="font-mono text-[12px] text-hfq-text-muted">policy.ts:118</div>
        </Card>
        <Card>
          <SectionTitle>Variables</SectionTitle>
          <div className="font-mono text-[12px] text-hfq-text-secondary">step: ToolCall</div>
          <div className="font-mono text-[12px] text-hfq-text-secondary">decision: &quot;ask&quot;</div>
        </Card>
        <Card>
          <SectionTitle>Call stack</SectionTitle>
          <div className="flex items-center gap-2 text-[12px] text-hfq-text-muted">
            <IconBug size={14} /> runAgentLoop
          </div>
        </Card>
      </div>
    </div>
  );
}

export function PluginsScreen() {
  return (
    <div>
      <PageHeader title="Plugins" description="Installed extensions" />
      <Card className="flex items-center justify-between">
        <div>
          <div className="font-semibold">Obsidian UI Preview</div>
          <div className="text-[12px] text-hfq-text-muted">@hfq/obsidian-ui · local</div>
        </div>
        <Badge tone="ok">enabled</Badge>
      </Card>
    </div>
  );
}

export function AccountScreen() {
  return (
    <div>
      <PageHeader title="Account" description="Profile · usage · subscription" />
      <div className="grid grid-cols-[280px_1fr] gap-4">
        <Card className="flex flex-col items-center gap-3 py-8">
          <Avatar initials="BP" size={64} />
          <div className="text-center">
            <div className="font-semibold">Binbim_ProMax</div>
            <div className="text-[12px] text-hfq-text-muted">Pro · seats 1</div>
          </div>
        </Card>
        <Card>
          <SectionTitle>Usage this month</SectionTitle>
          <div className="mb-2 flex justify-between text-[12px] text-hfq-text-muted">
            <span>Agent tokens</span>
            <span>62%</span>
          </div>
          <ProgressBar value={62} tone="violet" />
        </Card>
      </div>
    </div>
  );
}

export function NotificationsScreen() {
  return (
    <div>
      <PageHeader title="Notification Center" description="Alerts · updates · AI events" />
      <div className="space-y-2">
        {[
          { t: "Agent completed Harden login flow", m: "3 file changes ready for review", tone: "ok" as const },
          { t: "Update 1.0.10 available", m: "Multi-source fallback polish", tone: "cyan" as const },
          { t: "Permission denied: path escape", m: "tools.read outside workspace", tone: "danger" as const },
        ].map((n) => (
          <Card key={n.t} className="flex items-start gap-3 py-3">
            <IconBell size={16} className="mt-0.5 text-hfq-text-muted" />
            <div className="flex-1">
              <div className="text-[13px] font-semibold">{n.t}</div>
              <div className="text-[12px] text-hfq-text-muted">{n.m}</div>
            </div>
            <Badge tone={n.tone}>{n.tone}</Badge>
          </Card>
        ))}
      </div>
    </div>
  );
}

export function SearchScreen() {
  return (
    <div>
      <PageHeader title="Search" description="Files, symbols, commands, AI memory" />
      <EmptyState
        icon={<IconUser size={20} />}
        title="Start typing to search"
        description="Results span the workspace index and recent agent transcripts."
      />
    </div>
  );
}

export function PlaceholderNote() {
  return (
    <Card className="text-[12px] text-hfq-text-muted">
      Screen wired to shell navigation · content mirrors Obsidian prototype.
    </Card>
  );
}
