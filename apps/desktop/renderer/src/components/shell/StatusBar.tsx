import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { shortPath } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";
import { getHfq, hasHfq, type GitStatus } from "@/lib/hfq";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const navigate = useNavigate();
  const info = useAppStore((s) => s.info);
  const workspace = useAppStore((s) => s.workspace);
  const running = useAppStore((s) => s.running);
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const setDrawerTab = useUiStore((s) => s.setDrawerTab);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const [git, setGit] = useState<GitStatus | null>(null);

  const session = sessions.find((s) => s.id === activeSessionId);
  const sessModel = session?.model ? String(session.model).trim() : "";
  const globalModel = info?.activeModel ? String(info.activeModel).trim() : "";
  const displayModel = sessModel || globalModel;
  const modelMismatch = Boolean(sessModel && globalModel && sessModel !== globalModel);

  useEffect(() => {
    if (!hasHfq() || !workspace?.path) {
      setGit(null);
      return;
    }
    let cancelled = false;
    let interval: ReturnType<typeof setInterval>;
    const load = async () => {
      try {
        const st = await getHfq().gitStatus({ includeLog: false });
        if (!cancelled) setGit(st);
      } catch {
        if (!cancelled) setGit(null);
      }
    };
    const schedule = (ms: number) => {
      if (interval) clearInterval(interval);
      interval = setInterval(load, ms);
    };
    void load();
    schedule(8000);
    const onVis = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        void load();
        schedule(8000);
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [workspace?.path]);

  return (
    <footer className="flex h-6 shrink-0 items-center gap-1.5 border-t border-border/30 bg-[hsl(var(--statusbar))] px-2 text-[11px] text-muted-foreground/80">
      {/* Left: product + version */}
      <button
        type="button"
        className="cursor-pointer font-medium text-foreground/70 transition-colors duration-150 hover:text-foreground"
        onClick={() => setCommandOpen(true)}
        title="命令面板 (Ctrl+K)"
      >
        HFQ
      </button>
      {info?.version && (
        <span className="opacity-60">v{String(info.version)}</span>
      )}

      <span className="h-3 w-px bg-border/40" aria-hidden />

      {/* Git status */}
      {git?.isRepo ? (
        <button
          type="button"
          className="cursor-pointer truncate transition-colors duration-150 hover:text-foreground"
          title="打开改动"
          onClick={() => {
            setDrawerTab("changes");
            navigate("/changes");
          }}
        >
          <span className="font-mono">{git.branch ?? "git"}</span>
          <span className={git.dirty ? "text-warning/80" : "text-success/70"}>
            {git.dirty ? " · 有改动" : " · 干净"}
          </span>
        </button>
      ) : (
        <span className="opacity-60">{workspace?.path ? "非 Git" : "—"}</span>
      )}

      <span className="h-3 w-px bg-border/40" aria-hidden />

      {/* Agent status */}
      <span
        className={
          running
            ? "inline-flex items-center gap-1 font-medium text-success"
            : "inline-flex items-center gap-1 opacity-70"
        }
        aria-live="polite"
      >
        <span className={running ? "status-dot-running status-pulse" : "status-dot-idle"} />
        {running ? "运行中" : "空闲"}
      </span>

      <span className="h-3 w-px bg-border/40" aria-hidden />

      {/* Model */}
      <button
        type="button"
        className={cn(
          "max-w-[140px] cursor-pointer truncate font-mono transition-colors duration-150 hover:text-foreground",
          !displayModel && "text-warning/70",
        )}
        title={
          modelMismatch
            ? `本会话: ${sessModel}\n全局: ${globalModel}\n点击打开模型页`
            : displayModel
              ? `${displayModel} · 点击打开模型页`
              : "未配置模型 · 点击打开模型页"
        }
        onClick={() => navigate("/models")}
      >
        {displayModel || "未配置模型"}
      </button>

      {/* Right: workspace path */}
      <button
        type="button"
        className="ml-auto max-w-[45%] cursor-pointer truncate opacity-60 transition-colors duration-150 hover:text-foreground"
        title={workspace?.path ? String(workspace.path) : "未绑定工作区"}
        onClick={() => void useAppStore.getState().openWorkspace()}
      >
        {workspace?.path ? shortPath(String(workspace.path), 48) : "未绑定工作区"}
      </button>
    </footer>
  );
}
