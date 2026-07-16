import type { ComponentType, ReactNode } from "react";
import {
  IconBell,
  IconBot,
  IconBug,
  IconCode,
  IconFolder,
  IconGit,
  IconLayout,
  IconMsg,
  IconPalette,
  IconPlug,
  IconRepo,
  IconReview,
  IconSearch,
  IconSettings,
  IconStore,
  IconTasks,
  IconTerm,
  IconUser,
} from "@/icons";
import { cn } from "@/lib/cn";
import type { IconProps } from "@/icons";

export type NavId =
  | "dashboard"
  | "projects"
  | "files"
  | "agent"
  | "chat"
  | "review"
  | "tasks"
  | "editor"
  | "terminal"
  | "git"
  | "debugger"
  | "plugins"
  | "marketplace"
  | "design"
  | "settings"
  | "account"
  | "search"
  | "notifications";

export interface NavItemDef {
  id: NavId;
  label: string;
  icon: ComponentType<IconProps>;
  count?: number | string;
}

export interface NavSection {
  label: string;
  items: NavItemDef[];
}

export const DEFAULT_NAV: NavSection[] = [
  {
    label: "Workspace",
    items: [
      { id: "dashboard", label: "Dashboard", icon: IconLayout },
      { id: "projects", label: "Projects", icon: IconRepo },
      { id: "files", label: "Repositories", icon: IconFolder },
    ],
  },
  {
    label: "AI",
    items: [
      { id: "agent", label: "AI Agent", icon: IconBot, count: 1 },
      { id: "chat", label: "AI Chat", icon: IconMsg },
      { id: "review", label: "Code Review", icon: IconReview, count: 3 },
      { id: "tasks", label: "Autonomous Tasks", icon: IconTasks, count: 2 },
    ],
  },
  {
    label: "Development",
    items: [
      { id: "editor", label: "Editor", icon: IconCode },
      { id: "terminal", label: "Terminal", icon: IconTerm },
      { id: "git", label: "Git", icon: IconGit },
      { id: "debugger", label: "Debugger", icon: IconBug },
    ],
  },
  {
    label: "Tools",
    items: [
      { id: "plugins", label: "Plugins", icon: IconPlug },
      { id: "marketplace", label: "Marketplace", icon: IconStore },
      { id: "design", label: "Design System", icon: IconPalette },
    ],
  },
  {
    label: "System",
    items: [
      { id: "settings", label: "Settings", icon: IconSettings },
      { id: "account", label: "Account", icon: IconUser },
      { id: "search", label: "Search", icon: IconSearch },
      { id: "notifications", label: "Notifications", icon: IconBell },
    ],
  },
];

export function Sidebar({
  active,
  onNavigate,
  collapsed,
  agentModel = "gpt-4.1-mini · 12k ctx",
  agentStatus = "Agent ready",
  sections = DEFAULT_NAV,
}: {
  active: NavId;
  onNavigate: (id: NavId) => void;
  collapsed?: boolean;
  agentModel?: string;
  agentStatus?: string;
  sections?: NavSection[];
}) {
  return (
    <aside className="flex min-h-0 flex-col overflow-hidden border-r border-hfq-border bg-hfq-bg-secondary">
      <div className="flex-1 overflow-auto px-2.5 pb-4 pt-3">
        {sections.map((section) => (
          <div key={section.label} className="mb-3.5">
            {!collapsed && (
              <div className="px-2.5 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-hfq-text-disabled">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon;
              const isActive = active === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  title={item.label}
                  onClick={() => onNavigate(item.id)}
                  className={cn(
                    "mb-0.5 flex h-[34px] w-full items-center gap-2.5 rounded-md px-2.5 text-left text-hfq-text-muted transition-all duration-160 ease-hfq",
                    "hover:bg-hfq-bg-surface hover:text-hfq-text-primary",
                    isActive &&
                      "bg-[rgba(34,211,238,0.1)] text-hfq-brand-cyan shadow-[inset_0_0_0_1px_rgba(34,211,238,0.18)]",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon size={16} className="opacity-90" />
                  {!collapsed && (
                    <>
                      <span className="truncate text-[13px]">{item.label}</span>
                      {item.count != null && (
                        <span
                          className={cn(
                            "ml-auto grid h-[18px] place-items-center rounded-full border border-hfq-border bg-hfq-bg-surface px-[7px] font-mono text-[11px] text-hfq-text-disabled",
                            isActive &&
                              "border-[rgba(34,211,238,0.22)] bg-[var(--hfq-cyan-soft)] text-hfq-brand-cyan",
                          )}
                        >
                          {item.count}
                        </span>
                      )}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!collapsed && (
        <div className="border-t border-hfq-border p-2.5">
          <AgentStatusCard status={agentStatus} model={agentModel} />
        </div>
      )}
    </aside>
  );
}

export function AgentStatusCard({
  status,
  model,
}: {
  status: string;
  model: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[rgba(139,92,246,0.2)] bg-gradient-to-br from-[rgba(139,92,246,0.12)] to-[rgba(34,211,238,0.06)] p-2.5">
      <span className="h-2 w-2 animate-hfq-pulse rounded-full bg-hfq-success" />
      <div className="min-w-0">
        <strong className="block text-[12px] font-semibold">{status}</strong>
        <span className="text-[11px] text-hfq-text-muted">{model}</span>
      </div>
    </div>
  );
}

export function StatusBar({
  items = [
    { label: "main", tone: "cyan" as const },
    { label: "0 errors", tone: "ok" as const },
    { label: "UTF-8" },
    { label: "LF" },
  ],
  right,
}: {
  items?: { label: string; tone?: "ok" | "warn" | "cyan" }[];
  right?: ReactNode;
}) {
  const toneCls = {
    ok: "text-hfq-success",
    warn: "text-hfq-warning",
    cyan: "text-hfq-brand-cyan",
  };
  return (
    <footer className="flex h-statusbar items-center gap-3.5 border-t border-hfq-border bg-[#0a0e14] px-3 font-mono text-[11px] text-hfq-text-muted">
      {items.map((it) => (
        <span
          key={it.label}
          className={cn("inline-flex items-center gap-1.5", it.tone && toneCls[it.tone])}
        >
          {it.label}
        </span>
      ))}
      <span className="flex-1" />
      {right ?? <span className="text-hfq-brand-cyan">Obsidian · ready</span>}
    </footer>
  );
}
