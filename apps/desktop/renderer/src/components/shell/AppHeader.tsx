import {
  PanelLeft,
  PanelRight,
  Square,
  FolderOpen,
  Command,
  Shield,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { shortPath } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import {
  isWorkbenchRoute,
  pageTitle,
  useUiStore,
} from "@/store/ui-store";
import {
  PERMISSION_MODES,
  permissionModeMeta,
} from "@/features/chat/permission-modes";

export function AppHeader() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname.replace(/^\//, "") || "chat";
  const workbench = isWorkbenchRoute(path);

  const info = useAppStore((s) => s.info);
  const workspace = useAppStore((s) => s.workspace);
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const running = useAppStore((s) => s.running);
  const permissionMode = useAppStore((s) => s.permissionMode);
  const setSessionPermissionMode = useAppStore((s) => s.setSessionPermissionMode);
  const abortSession = useAppStore((s) => s.abortSession);
  const openWorkspace = useAppStore((s) => s.openWorkspace);

  const toggleDrawer = useUiStore((s) => s.toggleDrawer);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  const session = sessions.find((s) => s.id === activeSessionId);
  const sessionTitle = session?.title || session?.goal || "新会话";
  // Prefer live session model (post open rebind / setActive hot-swap) over global.
  // Never invent mock-hfq when both are empty (empty providers fail-closed).
  const rawSessionModel = session?.model ? String(session.model).trim() : "";
  const rawGlobalModel = info?.activeModel ? String(info.activeModel).trim() : "";
  const displayModel = rawSessionModel || rawGlobalModel;
  const globalModel = rawGlobalModel;
  const modelMismatch = Boolean(
    rawSessionModel && globalModel && rawSessionModel !== globalModel,
  );
  const title = workbench && path === "chat" ? sessionTitle : pageTitle(path);
  const wsLabel = workspace?.path
    ? shortPath(String(workspace.path), 48)
    : "未绑定工作区";
  const modeMeta = permissionModeMeta(permissionMode);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-border/80 bg-[hsl(var(--panel))] px-3.5">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        {workbench && (
          <Button
            size="icon-sm"
            variant={sidebarOpen ? "ghost" : "secondary"}
            className="shrink-0"
            title="会话侧栏 (Ctrl+B)"
            aria-label="切换会话侧栏"
            aria-pressed={sidebarOpen}
            onClick={() => toggleSidebar()}
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            {path === "chat" && (
              <span
                className={running ? "status-dot-running status-pulse" : "status-dot-idle"}
                aria-hidden
              />
            )}
            <div className="truncate text-[15px] font-semibold leading-none tracking-tight">
              {title}
            </div>
            {running && path === "chat" && (
              <Badge variant="success" className="font-normal">
                running
              </Badge>
            )}
            {workbench && path !== "chat" && session && (
              <span className="hidden truncate text-sm text-muted-foreground sm:inline">
                · {sessionTitle}
              </span>
            )}
          </div>
          {workbench && (
            <button
              type="button"
              onClick={() => void openWorkspace()}
              className="interactive mt-1 max-w-full truncate rounded-sm text-left text-xs text-muted-foreground hover:text-foreground"
              title={workspace?.path ? String(workspace.path) : "点击打开工作区"}
              aria-label={workspace?.path ? `工作区 ${workspace.path}` : "打开工作区"}
            >
              {wsLabel}
            </button>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {workbench && activeSessionId && (
          <label className="mr-0.5 hidden items-center gap-1.5 sm:inline-flex" title={modeMeta.hint}>
            <Shield
              className={
                modeMeta.warn
                  ? "h-3.5 w-3.5 shrink-0 text-warning"
                  : "h-3.5 w-3.5 shrink-0 text-muted-foreground"
              }
            />
            <select
              className="h-8 max-w-[132px] cursor-pointer rounded-md border border-border/80 bg-[hsl(var(--panel-elevated))] px-2 text-xs text-foreground outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring"
              value={modeMeta.id}
              aria-label="权限模式"
              onChange={(e) => void setSessionPermissionMode(e.target.value)}
            >
              {PERMISSION_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.short}
                </option>
              ))}
            </select>
          </label>
        )}
        {workbench &&
          (displayModel ? (
            <button
              type="button"
              className="mr-1 hidden max-w-[200px] md:inline-flex"
              title={
                modelMismatch
                  ? `本会话: ${rawSessionModel}\n全局默认: ${globalModel}\n点击打开「模型」；点选模型会热切换当前会话`
                  : `${displayModel} · 点击打开「模型」`
              }
              onClick={() => navigate("/models")}
            >
              <Badge
                variant={modelMismatch ? "outline" : "secondary"}
                className={
                  modelMismatch
                    ? "max-w-[200px] cursor-pointer truncate border-warning/50 font-mono font-normal text-warning"
                    : "max-w-[200px] cursor-pointer truncate font-mono font-normal"
                }
              >
                {displayModel}
                {modelMismatch ? " · 会话" : ""}
              </Badge>
            </button>
          ) : (
            <button
              type="button"
              className="mr-1 hidden max-w-[200px] md:inline-flex"
              title="providers 为空或未选择模型 · 点击打开「模型」页"
              onClick={() => navigate("/models")}
            >
              <Badge
                variant="outline"
                className="max-w-[200px] cursor-pointer truncate font-normal text-warning"
              >
                未配置模型
              </Badge>
            </button>
          ))}
        {!workspace?.path && (
          <Button size="sm" variant="outline" onClick={() => void openWorkspace()}>
            <FolderOpen className="h-4 w-4" />
            工作区
          </Button>
        )}
        {running && (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void abortSession()}
            title="停止 Agent (Esc)"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
            停止
          </Button>
        )}
        <Button
          size="icon-sm"
          variant="ghost"
          title="命令面板 (Ctrl+K)"
          aria-label="打开命令面板"
          onClick={() => setCommandOpen(true)}
        >
          <Command className="h-4 w-4" />
        </Button>
        <Button
          size="icon-sm"
          variant={drawerOpen ? "secondary" : "ghost"}
          title="检视面板 (Ctrl+J)"
          aria-label="切换检视面板"
          aria-pressed={drawerOpen}
          onClick={() => toggleDrawer()}
        >
          <PanelRight className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
}
