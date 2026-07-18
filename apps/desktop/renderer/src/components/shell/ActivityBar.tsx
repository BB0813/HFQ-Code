import type { ElementType } from "react";
import {
  Bot,
  FolderTree,
  GitBranch,
  Home,
  ListTodo,
  Settings,
  Sparkles,
  MoreHorizontal,
  MessageSquare,
  Database,
  Plug,
  Download,
  Cpu,
  BarChart3,
  Shield,
  ScrollText,
  Terminal,
} from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useUiStore, type ActivityId, type DrawerTab } from "@/store/ui-store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const PRIMARY: {
  id: ActivityId;
  icon: ElementType;
  label: string;
  path: string;
  drawer?: DrawerTab;
}[] = [
  { id: "chat", icon: MessageSquare, label: "会话", path: "/chat" },
  { id: "files", icon: FolderTree, label: "文件", path: "/files" },
  {
    id: "changes",
    icon: GitBranch,
    label: "改动",
    path: "/changes",
    drawer: "changes",
  },
  {
    id: "terminal",
    icon: Terminal,
    label: "终端",
    path: "/terminal",
  },
  {
    id: "tasks",
    icon: ListTodo,
    label: "任务",
    path: "/tasks",
    drawer: "tasks",
  },
  { id: "skills", icon: Sparkles, label: "技能", path: "/skills" },
];

const MORE: { id: ActivityId; icon: ElementType; label: string; path: string }[] =
  [
    { id: "home", icon: Home, label: "主页", path: "/home" },
    { id: "mcp", icon: Plug, label: "MCP", path: "/mcp" },
    { id: "memory", icon: Database, label: "记忆", path: "/memory" },
    { id: "import", icon: Download, label: "导入", path: "/import" },
    { id: "models", icon: Cpu, label: "模型", path: "/models" },
    { id: "usage", icon: BarChart3, label: "用量", path: "/usage" },
    { id: "permissions", icon: Shield, label: "权限", path: "/permissions" },
    { id: "audit", icon: ScrollText, label: "审计", path: "/audit" },
  ];

function RailButton({
  active,
  label,
  icon: Icon,
  onClick,
}: {
  active?: boolean;
  label: string;
  icon: ElementType;
  onClick: () => void;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors duration-150",
            "hover:bg-white/[0.07] hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(240_9%_3%)]",
            active && "bg-workbench/15 text-foreground shadow-inner ring-1 ring-workbench/25",
          )}
          aria-label={label}
          aria-current={active ? "page" : undefined}
        >
          {active && <span className="rail-active-bar" aria-hidden />}
          <Icon
            className={cn("h-[18px] w-[18px]", active && "text-workbench")}
            strokeWidth={active ? 2 : 1.75}
          />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export function ActivityBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const setActivity = useUiStore((s) => s.setActivity);
  const setDrawerTab = useUiStore((s) => s.setDrawerTab);
  const path = location.pathname.replace(/^\//, "") || "chat";
  const moreActive = MORE.some((m) => m.id === path);

  const go = (id: ActivityId, route: string, drawer?: DrawerTab) => {
    setActivity(id);
    if (drawer) setDrawerTab(drawer);
    navigate(route);
  };

  return (
    <aside className="flex w-12 shrink-0 flex-col items-center border-r border-sidebar-border bg-[hsl(var(--activitybar))] py-2.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => go("home", "/home")}
            className={cn(
              "mb-2.5 flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg shadow-sm duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(240_9%_3%)]",
              path === "home"
                ? "bg-zinc-50 text-zinc-900 ring-1 ring-white/25"
                : "bg-zinc-100/95 text-zinc-900 hover:bg-white",
            )}
            aria-label="HFQ Code 主页"
          >
            <Bot className="h-[18px] w-[18px]" strokeWidth={2} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">主页</TooltipContent>
      </Tooltip>

      <nav className="flex flex-1 flex-col items-center gap-1" aria-label="主导航">
        {PRIMARY.map((item) => (
          <RailButton
            key={item.id}
            active={path === item.id || (path === "" && item.id === "chat")}
            label={item.label}
            icon={item.icon}
            onClick={() => go(item.id, item.path, item.drawer)}
          />
        ))}
        <div className="my-1.5 h-px w-6 bg-white/[0.08]" role="separator" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-lg text-muted-foreground duration-150",
                "hover:bg-white/[0.07] hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-[hsl(240_9%_3%)]",
                moreActive && "bg-workbench/15 text-foreground ring-1 ring-workbench/25",
              )}
              aria-label="更多页面"
            >
              {moreActive && <span className="rail-active-bar" aria-hidden />}
              <MoreHorizontal
                className={cn("h-[18px] w-[18px]", moreActive && "text-workbench")}
              />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="w-48">
            {MORE.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onClick={() => go(item.id, item.path)}
                className={cn("cursor-pointer gap-2.5 py-2", path === item.id && "bg-accent")}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
      <RailButton
        active={path === "settings"}
        label="设置"
        icon={Settings}
        onClick={() => go("settings", "/settings")}
      />
    </aside>
  );
}
