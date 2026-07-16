import { useEffect, useMemo, useState, type ElementType } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  Cpu,
  Database,
  Download,
  FolderOpen,
  FolderTree,
  GitBranch,
  Home,
  ListTodo,
  MessageSquare,
  MessageSquarePlus,
  PanelRight,
  Plug,
  ScrollText,
  Settings,
  Shield,
  Sparkles,
  Square,
  Terminal,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useUiStore, type DrawerTab } from "@/store/ui-store";

type Cmd = {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon: ElementType;
  run: () => void | Promise<void>;
};

export function CommandPalette() {
  const open = useUiStore((s) => s.commandOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setDrawerTab = useUiStore((s) => s.setDrawerTab);
  const toggleDrawer = useUiStore((s) => s.toggleDrawer);
  const navigate = useNavigate();
  const createSession = useAppStore((s) => s.createSession);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const abortSession = useAppStore((s) => s.abortSession);
  const running = useAppStore((s) => s.running);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);

  const commands = useMemo<Cmd[]>(() => {
    const go = (path: string) => {
      navigate(path);
      setCommandOpen(false);
    };
    const drawer = (tab: DrawerTab) => {
      setDrawerTab(tab);
      setCommandOpen(false);
    };
    return [
      {
        id: "new-session",
        label: "新建会话",
        hint: "Ctrl+N",
        group: "会话",
        icon: MessageSquarePlus,
        run: async () => {
          await createSession();
          go("/chat");
        },
      },
      {
        id: "open-ws",
        label: "打开工作区",
        group: "工作区",
        icon: FolderOpen,
        run: async () => {
          await openWorkspace();
          setCommandOpen(false);
        },
      },
      {
        id: "stop",
        label: "停止 Agent",
        group: "会话",
        icon: Square,
        run: async () => {
          if (running) await abortSession();
          setCommandOpen(false);
        },
      },
      {
        id: "nav-chat",
        label: "转到会话",
        group: "导航",
        icon: MessageSquare,
        run: () => go("/chat"),
      },
      {
        id: "nav-files",
        label: "转到文件",
        group: "导航",
        icon: FolderTree,
        run: () => go("/files"),
      },
      {
        id: "nav-changes",
        label: "转到改动",
        group: "导航",
        icon: GitBranch,
        run: () => go("/changes"),
      },
      {
        id: "nav-terminal",
        label: "转到终端",
        group: "导航",
        icon: Terminal,
        run: () => go("/terminal"),
      },
      {
        id: "nav-tasks",
        label: "转到任务",
        group: "导航",
        icon: ListTodo,
        run: () => go("/tasks"),
      },
      {
        id: "nav-skills",
        label: "转到技能",
        group: "导航",
        icon: Sparkles,
        run: () => go("/skills"),
      },
      {
        id: "nav-home",
        label: "转到主页",
        group: "导航",
        icon: Home,
        run: () => go("/home"),
      },
      {
        id: "nav-settings",
        label: "转到设置",
        group: "导航",
        icon: Settings,
        run: () => go("/settings"),
      },
      {
        id: "nav-models",
        label: "转到模型",
        group: "导航",
        icon: Cpu,
        run: () => go("/models"),
      },
      {
        id: "nav-mcp",
        label: "转到 MCP",
        group: "导航",
        icon: Plug,
        run: () => go("/mcp"),
      },
      {
        id: "nav-memory",
        label: "转到记忆",
        group: "导航",
        icon: Database,
        run: () => go("/memory"),
      },
      {
        id: "nav-import",
        label: "转到导入",
        group: "导航",
        icon: Download,
        run: () => go("/import"),
      },
      {
        id: "nav-usage",
        label: "转到用量",
        group: "导航",
        icon: BarChart3,
        run: () => go("/usage"),
      },
      {
        id: "nav-permissions",
        label: "转到权限",
        group: "导航",
        icon: Shield,
        run: () => go("/permissions"),
      },
      {
        id: "nav-audit",
        label: "转到审计",
        group: "导航",
        icon: ScrollText,
        run: () => go("/audit"),
      },
      {
        id: "drawer-changes",
        label: "打开检视 · 改动",
        group: "面板",
        icon: PanelRight,
        run: () => drawer("changes"),
      },
      {
        id: "drawer-terminal",
        label: "打开检视 · 终端",
        group: "面板",
        icon: Terminal,
        run: () => drawer("terminal"),
      },
      {
        id: "drawer-tasks",
        label: "打开检视 · 任务",
        group: "面板",
        icon: ListTodo,
        run: () => drawer("tasks"),
      },
      {
        id: "toggle-drawer",
        label: "切换检视面板",
        hint: "Ctrl+J",
        group: "面板",
        icon: PanelRight,
        run: () => {
          toggleDrawer();
          setCommandOpen(false);
        },
      },
    ];
  }, [
    navigate,
    setCommandOpen,
    setDrawerTab,
    toggleDrawer,
    createSession,
    openWorkspace,
    abortSession,
    running,
  ]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return commands;
    return commands.filter(
      (c) =>
        c.label.toLowerCase().includes(needle) ||
        c.group.toLowerCase().includes(needle) ||
        c.id.includes(needle),
    );
  }, [commands, q]);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => {
    setActive(0);
  }, [q]);

  const runActive = () => {
    const cmd = filtered[active];
    if (cmd) void cmd.run();
  };

  return (
    <Dialog open={open} onOpenChange={setCommandOpen}>
      <DialogContent className="gap-0 overflow-hidden border-border/80 bg-[hsl(240_8%_6%)] p-0 shadow-2xl sm:max-w-md [&>button]:right-2.5 [&>button]:top-2.5">
        <DialogHeader className="sr-only">
          <DialogTitle>命令面板</DialogTitle>
        </DialogHeader>
        <div className="border-b border-border/70 px-3 py-2 pr-10">
          <Input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="输入命令或跳转…"
            className="h-9 border-0 bg-transparent shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((i) => Math.min(filtered.length - 1, i + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((i) => Math.max(0, i - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                runActive();
              }
            }}
          />
        </div>
        <div
          className="max-h-72 overflow-auto py-1"
          role="listbox"
          aria-label="命令列表"
          aria-activedescendant={filtered[active] ? `cmd-${filtered[active].id}` : undefined}
        >
          {filtered.length === 0 && (
            <div className="px-3 py-10 text-center text-sm text-muted-foreground">
              无匹配命令
            </div>
          )}
          {filtered.map((cmd, i) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                id={`cmd-${cmd.id}`}
                type="button"
                role="option"
                aria-selected={i === active}
                className={cn(
                  "interactive flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm",
                  i === active
                    ? "bg-white/[0.08] text-foreground"
                    : "text-foreground/90 hover:bg-white/[0.04]",
                )}
                onMouseEnter={() => setActive(i)}
                onClick={() => void cmd.run()}
              >
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground/70">
                  {cmd.hint || cmd.group}
                </span>
              </button>
            );
          })}
        </div>
        <div className="border-t border-border px-3 py-1.5 text-xs text-muted-foreground">
          ↑↓ 选择 · Enter 执行 · Esc 关闭
        </div>
      </DialogContent>
    </Dialog>
  );
}
