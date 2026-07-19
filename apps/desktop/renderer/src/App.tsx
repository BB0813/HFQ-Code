import { lazy, Suspense, useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAppStore } from "@/store/app-store";
import { HomePage } from "@/pages/HomePage";
import { ChatPage } from "@/pages/ChatPage";
import { SettingsPage } from "@/pages/SettingsPage";

// Lazy secondary pages — first paint doesn't need these bundles.
// Static import paths (Vite needs literal strings for code-splitting).
const FilesPage = lazy(() => import("@/pages/FilesPage").then((m) => ({ default: m.FilesPage })));
const ChangesPage = lazy(() => import("@/pages/ChangesPage").then((m) => ({ default: m.ChangesPage })));
const TerminalPage = lazy(() => import("@/pages/TerminalPage").then((m) => ({ default: m.TerminalPage })));
const TasksPage = lazy(() => import("@/pages/TasksPage").then((m) => ({ default: m.TasksPage })));
const SkillsPage = lazy(() => import("@/pages/SkillsPage").then((m) => ({ default: m.SkillsPage })));
const McpPage = lazy(() => import("@/pages/McpPage").then((m) => ({ default: m.McpPage })));
const MemoryPage = lazy(() => import("@/pages/MemoryPage").then((m) => ({ default: m.MemoryPage })));
const ImportPage = lazy(() => import("@/pages/ImportPage").then((m) => ({ default: m.ImportPage })));
const ModelsPage = lazy(() => import("@/pages/ModelsPage").then((m) => ({ default: m.ModelsPage })));
const UsagePage = lazy(() => import("@/pages/UsagePage").then((m) => ({ default: m.UsagePage })));
const PermissionsPage = lazy(() => import("@/pages/PermissionsPage").then((m) => ({ default: m.PermissionsPage })));
const AuditPage = lazy(() => import("@/pages/AuditPage").then((m) => ({ default: m.AuditPage })));

const BOOT_ROUTES = new Set([
  "home",
  "chat",
  "files",
  "changes",
  "terminal",
  "tasks",
  "skills",
  "mcp",
  "memory",
  "import",
  "models",
  "usage",
  "permissions",
  "audit",
  "settings",
]);

function BootRoute() {
  const navigate = useNavigate();
  const ready = useAppStore((s) => s.ready);
  const consumeBootRoute = useAppStore((s) => s.consumeBootRoute);
  useEffect(() => {
    if (!ready) return;
    const route = (consumeBootRoute() || "").replace(/^\/+/, "");
    if (route && BOOT_ROUTES.has(route)) {
      navigate(`/${route}`, { replace: true });
    }
  }, [ready, navigate, consumeBootRoute]);
  return null;
}

/** Sticky banner copy used only by the splash failsafe (cleared when bootstrap finishes). */
const BOOT_FAILSAFE_ERROR = "启动超时，部分状态可能未就绪";
/**
 * Must exceed bootstrap IPC budget (getInfo 5s + refreshSessions 4s ≈ 9s, plus margin).
 * Older 8s raced a healthy slow boot and left a sticky false-positive banner.
 */
const BOOT_FAILSAFE_MS = 12_000;

export function App() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const ready = useAppStore((s) => s.ready);
  const error = useAppStore((s) => s.error);

  useEffect(() => {
    let cancelled = false;
    void bootstrap().finally(() => {
      if (cancelled) return;
      // Bootstrap settled (ok or soft-nulls): drop failsafe-only sticky error.
      const st = useAppStore.getState();
      if (st.error === BOOT_FAILSAFE_ERROR) {
        useAppStore.setState({ error: null });
      }
    });
    // Failsafe: never leave the splash forever if IPC truly hangs.
    const t = window.setTimeout(() => {
      const st = useAppStore.getState();
      if (!st.ready) {
        useAppStore.setState({
          ready: true,
          error: st.error ?? BOOT_FAILSAFE_ERROR,
          statusLine: st.statusLine || "Bootstrap timeout",
        });
      }
    }, BOOT_FAILSAFE_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [bootstrap]);

  if (!ready) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-background">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-zinc-100 text-zinc-900 shadow-lg shadow-black/40">
          <span className="text-sm font-bold tracking-tight">H</span>
        </div>
        <div className="text-xs text-muted-foreground">加载 HFQ Code…</div>
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={300}>
      <HashRouter>
        <BootRoute />
        <Suspense
          fallback={
            <div className="flex h-full items-center justify-center bg-[hsl(var(--background))]">
              <div className="text-xs text-muted-foreground">加载…</div>
            </div>
          }
        >
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to="/chat" replace />} />
              <Route path="home" element={<HomePage />} />
              <Route path="chat" element={<ChatPage />} />
              <Route path="files" element={<FilesPage />} />
              <Route path="changes" element={<ChangesPage />} />
              <Route path="terminal" element={<TerminalPage />} />
              <Route path="tasks" element={<TasksPage />} />
              <Route path="skills" element={<SkillsPage />} />
              <Route path="mcp" element={<McpPage />} />
              <Route path="memory" element={<MemoryPage />} />
              <Route path="import" element={<ImportPage />} />
              <Route path="models" element={<ModelsPage />} />
              <Route path="usage" element={<UsagePage />} />
              <Route path="permissions" element={<PermissionsPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route
                path="settings"
                element={
                  <ErrorBoundary label="settings">
                    <SettingsPage />
                  </ErrorBoundary>
                }
              />
              <Route path="*" element={<Navigate to="/chat" replace />} />
            </Route>
          </Routes>
        </Suspense>
      </HashRouter>
      {error && (
        <div
          role="alert"
          className="pointer-events-none fixed bottom-8 left-1/2 z-50 -translate-x-1/2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs text-destructive shadow-lg"
        >
          {error}
        </div>
      )}
      <Toaster
        theme="dark"
        position="bottom-right"
        richColors
        closeButton
        toastOptions={{
          className: "text-xs",
          duration: 2800,
        }}
      />
    </TooltipProvider>
  );
}
