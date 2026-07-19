import { create } from "zustand";

export type ActivityId =
  | "chat"
  | "files"
  | "changes"
  | "tasks"
  | "skills"
  | "home"
  | "mcp"
  | "memory"
  | "import"
  | "models"
  | "usage"
  | "permissions"
  | "audit"
  | "settings"
  | "terminal";

export type DrawerTab = "changes" | "terminal" | "tasks";

/** Routes where session list + inspector drawer are first-class chrome. */
export const WORKBENCH_ROUTES = new Set([
  "chat",
  "files",
  "changes",
  "terminal",
  "tasks",
]);

export function isWorkbenchRoute(path: string): boolean {
  const id = path.replace(/^\//, "") || "chat";
  return WORKBENCH_ROUTES.has(id);
}

export function routeActivity(path: string): ActivityId {
  const id = (path.replace(/^\//, "") || "chat") as ActivityId;
  return id;
}

export function pageTitle(path: string): string {
  const id = path.replace(/^\//, "") || "chat";
  const map: Record<string, string> = {
    chat: "会话",
    files: "文件",
    changes: "改动",
    terminal: "终端",
    tasks: "任务",
    skills: "技能",
    home: "主页",
    mcp: "MCP",
    memory: "记忆",
    import: "导入",
    models: "模型",
    usage: "用量",
    permissions: "权限",
    audit: "审计",
    settings: "设置",
  };
  return map[id] ?? "HFQ Code";
}

/** Layout A column width bounds (px). */
export const SIDEBAR_WIDTH_DEFAULT = 280;
export const SIDEBAR_WIDTH_MIN = 200;
export const SIDEBAR_WIDTH_MAX = 420;
export const DRAWER_WIDTH_DEFAULT = 380;
export const DRAWER_WIDTH_MIN = 280;
export const DRAWER_WIDTH_MAX = 560;

const LAYOUT_LS_KEY = "hfq-ui-layout-v1";

type LayoutPersist = {
  sidebarWidth?: number;
  drawerWidth?: number;
  sidebarOpen?: boolean;
  drawerOpen?: boolean;
  drawerTab?: DrawerTab;
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

function loadLayout(): LayoutPersist {
  try {
    const raw = localStorage.getItem(LAYOUT_LS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as LayoutPersist;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveLayout(patch: LayoutPersist): void {
  try {
    const next = { ...loadLayout(), ...patch };
    localStorage.setItem(LAYOUT_LS_KEY, JSON.stringify(next));
  } catch {
    /* ignore quota / private mode */
  }
}

const persisted = typeof window !== "undefined" ? loadLayout() : {};

interface UiState {
  activity: ActivityId;
  drawerOpen: boolean;
  drawerTab: DrawerTab;
  sidebarOpen: boolean;
  /** User explicitly toggled drawer; blocks auto-close on secondary routes until next workbench nav. */
  drawerPinned: boolean;
  commandOpen: boolean;
  theme: "dark" | "light";
  /** Session list column width (Layout A). */
  sidebarWidth: number;
  /** Right inspector drawer width (Layout A). */
  drawerWidth: number;
  /** Active coding profile display name (Header chip); null = none. */
  codingProfileName: string | null;
  setActivity: (id: ActivityId) => void;
  setDrawerOpen: (open: boolean) => void;
  setDrawerTab: (tab: DrawerTab) => void;
  toggleDrawer: (tab?: DrawerTab) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setCommandOpen: (open: boolean) => void;
  setTheme: (theme: "dark" | "light") => void;
  setSidebarWidth: (width: number) => void;
  setDrawerWidth: (width: number) => void;
  /** Hot-update Header chip after Settings save / config load. */
  setCodingProfileName: (name: string | null) => void;
  /** Sync chrome when route changes (auto hide drawer on secondary pages). */
  syncRoute: (path: string) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  activity: "chat",
  drawerOpen:
    typeof persisted.drawerOpen === "boolean" ? persisted.drawerOpen : true,
  drawerTab:
    persisted.drawerTab === "terminal" ||
    persisted.drawerTab === "tasks" ||
    persisted.drawerTab === "changes"
      ? persisted.drawerTab
      : "changes",
  sidebarOpen:
    typeof persisted.sidebarOpen === "boolean" ? persisted.sidebarOpen : true,
  drawerPinned: false,
  commandOpen: false,
  theme: "dark",
  codingProfileName: null,
  sidebarWidth: clamp(
    typeof persisted.sidebarWidth === "number"
      ? persisted.sidebarWidth
      : SIDEBAR_WIDTH_DEFAULT,
    SIDEBAR_WIDTH_MIN,
    SIDEBAR_WIDTH_MAX,
  ),
  drawerWidth: clamp(
    typeof persisted.drawerWidth === "number"
      ? persisted.drawerWidth
      : DRAWER_WIDTH_DEFAULT,
    DRAWER_WIDTH_MIN,
    DRAWER_WIDTH_MAX,
  ),
  setActivity: (id) => set({ activity: id }),
  setDrawerOpen: (open) => {
    set({ drawerOpen: open, drawerPinned: open });
    saveLayout({ drawerOpen: open });
  },
  setDrawerTab: (tab) => {
    set({ drawerTab: tab, drawerOpen: true, drawerPinned: true });
    saveLayout({ drawerTab: tab, drawerOpen: true });
  },
  toggleDrawer: (tab) => {
    const { drawerOpen, drawerTab } = get();
    if (tab && tab !== drawerTab) {
      set({ drawerTab: tab, drawerOpen: true, drawerPinned: true });
      saveLayout({ drawerTab: tab, drawerOpen: true });
      return;
    }
    const next = !drawerOpen;
    set({ drawerOpen: next, drawerPinned: next });
    saveLayout({ drawerOpen: next });
  },
  setSidebarOpen: (open) => {
    set({ sidebarOpen: open });
    saveLayout({ sidebarOpen: open });
  },
  toggleSidebar: () => {
    const next = !get().sidebarOpen;
    set({ sidebarOpen: next });
    saveLayout({ sidebarOpen: next });
  },
  setCommandOpen: (open) => set({ commandOpen: open }),
  setCodingProfileName: (name) => {
    const next = name && String(name).trim() ? String(name).trim() : null;
    set({ codingProfileName: next });
  },
  setTheme: (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    set({ theme });
  },
  setSidebarWidth: (width) => {
    const next = clamp(width, SIDEBAR_WIDTH_MIN, SIDEBAR_WIDTH_MAX);
    set({ sidebarWidth: next });
    saveLayout({ sidebarWidth: next });
  },
  setDrawerWidth: (width) => {
    const next = clamp(width, DRAWER_WIDTH_MIN, DRAWER_WIDTH_MAX);
    set({ drawerWidth: next });
    saveLayout({ drawerWidth: next });
  },
  syncRoute: (path) => {
    const id = routeActivity(path);
    const workbench = isWorkbenchRoute(path);
    const patch: Partial<UiState> = { activity: id };

    if (id === "changes") {
      patch.drawerTab = "changes";
      patch.drawerOpen = true;
      patch.drawerPinned = false;
    } else if (id === "tasks") {
      patch.drawerTab = "tasks";
      patch.drawerOpen = true;
      patch.drawerPinned = false;
    } else if (id === "terminal") {
      // Full-page terminal already owns the center; avoid double PTY chrome in drawer.
      patch.drawerTab = "changes";
      if (!get().drawerPinned) {
        patch.drawerOpen = false;
      }
    } else if (id === "chat") {
      // Keep current drawer state on chat; default open if never pinned closed.
      if (!get().drawerPinned && get().drawerOpen === false) {
        /* leave closed if user closed it */
      }
      patch.sidebarOpen = true;
    } else if (!workbench) {
      // Secondary pages: collapse inspector noise unless user pinned it open.
      if (!get().drawerPinned) {
        patch.drawerOpen = false;
      }
    }

    set(patch);
  },
}));
