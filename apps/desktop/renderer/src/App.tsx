import { useEffect } from "react";
import { HashRouter, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppShell } from "@/components/shell/AppShell";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAppStore } from "@/store/app-store";
import { HomePage } from "@/pages/HomePage";
import { ChatPage } from "@/pages/ChatPage";
import { ChangesPage } from "@/pages/ChangesPage";
import { FilesPage } from "@/pages/FilesPage";
import { TerminalPage } from "@/pages/TerminalPage";
import { TasksPage } from "@/pages/TasksPage";
import { SkillsPage } from "@/pages/SkillsPage";
import { McpPage } from "@/pages/McpPage";
import { MemoryPage } from "@/pages/MemoryPage";
import { ImportPage } from "@/pages/ImportPage";
import { ModelsPage } from "@/pages/ModelsPage";
import { UsagePage } from "@/pages/UsagePage";
import { PermissionsPage } from "@/pages/PermissionsPage";
import { AuditPage } from "@/pages/AuditPage";
import { SettingsPage } from "@/pages/SettingsPage";

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

export function App() {
  const bootstrap = useAppStore((s) => s.bootstrap);
  const ready = useAppStore((s) => s.ready);
  const error = useAppStore((s) => s.error);

  useEffect(() => {
    void bootstrap();
    // Failsafe: never leave the splash longer than 8s even if IPC hangs.
    const t = window.setTimeout(() => {
      const st = useAppStore.getState();
      if (!st.ready) {
        useAppStore.setState({
          ready: true,
          error: st.error ?? "启动超时，部分状态可能未就绪",
          statusLine: st.statusLine || "Bootstrap timeout",
        });
      }
    }, 8000);
    return () => window.clearTimeout(t);
  }, [bootstrap]);

  if (!ready) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[hsl(240_10%_3.6%)]">
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
