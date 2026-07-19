import { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { ActivityBar } from "./ActivityBar";
import { SessionSideBar } from "./SessionSideBar";
import { AppHeader } from "./AppHeader";
import { RightDrawer } from "./RightDrawer";
import { StatusBar } from "./StatusBar";
import { PermissionDialog } from "./PermissionDialog";
import { CommandPalette } from "./CommandPalette";
import { PanelResizeHandle } from "./PanelResizeHandle";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import {
  DRAWER_WIDTH_MAX,
  DRAWER_WIDTH_MIN,
  SIDEBAR_WIDTH_MAX,
  SIDEBAR_WIDTH_MIN,
  isWorkbenchRoute,
  useUiStore,
} from "@/store/ui-store";
import { useAppStore } from "@/store/app-store";

function ShellChrome() {
  const location = useLocation();
  const navigate = useNavigate();
  const syncRoute = useUiStore((s) => s.syncRoute);
  const toggleDrawer = useUiStore((s) => s.toggleDrawer);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const commandOpen = useUiStore((s) => s.commandOpen);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const sidebarWidth = useUiStore((s) => s.sidebarWidth);
  const drawerWidth = useUiStore((s) => s.drawerWidth);
  const drawerOpen = useUiStore((s) => s.drawerOpen);
  const setSidebarWidth = useUiStore((s) => s.setSidebarWidth);
  const setDrawerWidth = useUiStore((s) => s.setDrawerWidth);
  const createSession = useAppStore((s) => s.createSession);
  const abortSession = useAppStore((s) => s.abortSession);
  const openWorkspace = useAppStore((s) => s.openWorkspace);
  const running = useAppStore((s) => s.running);

  const path = location.pathname;
  const workbench = isWorkbenchRoute(path);

  useEffect(() => {
    syncRoute(path);
  }, [path, syncRoute]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const typing =
        tag === "input" ||
        tag === "textarea" ||
        target?.isContentEditable ||
        false;

      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCommandOpen(!commandOpen);
        return;
      }
      if (mod && e.key.toLowerCase() === "j") {
        e.preventDefault();
        toggleDrawer();
        return;
      }
      if (mod && e.key.toLowerCase() === "b") {
        e.preventDefault();
        if (workbench) toggleSidebar();
        return;
      }
      if (mod && e.key.toLowerCase() === "n" && !e.shiftKey) {
        if (typing) return;
        e.preventDefault();
        void createSession().then(() => navigate("/chat"));
        return;
      }
      if (mod && e.key.toLowerCase() === "o") {
        if (typing) return;
        e.preventDefault();
        void openWorkspace();
        return;
      }
      if (e.key === "Escape" && running && !typing) {
        void abortSession();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    abortSession,
    commandOpen,
    createSession,
    navigate,
    openWorkspace,
    running,
    setCommandOpen,
    toggleDrawer,
    toggleSidebar,
    workbench,
  ]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 flex-1">
        <ActivityBar />
        {workbench && sidebarOpen && (
          <>
            <div
              className="dock-split shrink-0"
              style={{ width: sidebarWidth }}
            >
              <SessionSideBar />
            </div>
            <PanelResizeHandle
              edge="after"
              value={sidebarWidth}
              min={SIDEBAR_WIDTH_MIN}
              max={SIDEBAR_WIDTH_MAX}
              onChange={setSidebarWidth}
              label="调整会话侧栏宽度"
            />
          </>
        )}
        <div className="flex min-w-0 flex-1 flex-col surface-3">
          <AppHeader />
          <main id="main-content" className="dock-pane-body min-h-0 flex-1" tabIndex={-1}>
            <ErrorBoundary label="main">
              <Outlet />
            </ErrorBoundary>
          </main>
        </div>
        {drawerOpen && (
          <PanelResizeHandle
            edge="before"
            value={drawerWidth}
            min={DRAWER_WIDTH_MIN}
            max={DRAWER_WIDTH_MAX}
            onChange={setDrawerWidth}
            label="调整检视面板宽度"
          />
        )}
        <RightDrawer />
      </div>
      <StatusBar />
      <PermissionDialog />
      <CommandPalette />
    </div>
  );
}

export function AppShell() {
  return <ShellChrome />;
}
