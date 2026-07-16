import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { shortPath } from "@/lib/utils";
import { useAppStore } from "@/store/app-store";
import { useUiStore } from "@/store/ui-store";
import { getHfq, hasHfq, type GitStatus } from "@/lib/hfq";

export function StatusBar() {
  const navigate = useNavigate();
  const info = useAppStore((s) => s.info);
  const workspace = useAppStore((s) => s.workspace);
  const running = useAppStore((s) => s.running);
  const setDrawerTab = useUiStore((s) => s.setDrawerTab);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const [git, setGit] = useState<GitStatus | null>(null);

  useEffect(() => {
    if (!hasHfq() || !workspace?.path) {
      setGit(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const st = await getHfq().gitStatus({ includeLog: false });
        if (!cancelled) setGit(st);
      } catch {
        if (!cancelled) setGit(null);
      }
    };
    void load();
    const t = window.setInterval(load, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(t);
    };
  }, [workspace?.path]);

  return (
    <footer className="flex h-7 shrink-0 items-center gap-2.5 border-t border-border/80 bg-[hsl(240_9%_3%)] px-2.5 text-xs text-muted-foreground">
      <button
        type="button"
        className="cursor-pointer font-medium text-foreground/85 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        onClick={() => setCommandOpen(true)}
        title="命令面板 (Ctrl+K)"
      >
        HFQ Code
      </button>
      {info?.version && <span className="opacity-70">v{String(info.version)}</span>}
      <span className="h-3.5 w-px bg-border/90" aria-hidden />
      {git?.isRepo ? (
        <button
          type="button"
          className="cursor-pointer truncate transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          title="打开改动"
          onClick={() => {
            setDrawerTab("changes");
            navigate("/changes");
          }}
        >
          <span className="font-mono">{git.branch ?? "git"}</span>
          {git.dirty ? (
            <span className="text-warning"> · dirty</span>
          ) : (
            <span className="text-success"> · clean</span>
          )}
        </button>
      ) : (
        <span className="opacity-70">{workspace?.path ? "非 Git" : "—"}</span>
      )}
      <span className="h-3.5 w-px bg-border/90" aria-hidden />
      <span
        className={
          running
            ? "inline-flex items-center gap-1.5 font-medium text-success"
            : "inline-flex items-center gap-1.5 opacity-80"
        }
        aria-live="polite"
      >
        <span className={running ? "status-dot-running status-pulse" : "status-dot-idle"} />
        {running ? "running" : "idle"}
      </span>
      {info?.activeModel && (
        <>
          <span className="h-3.5 w-px bg-border/90" aria-hidden />
          <button
            type="button"
            className="max-w-[180px] cursor-pointer truncate font-mono transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            title="模型设置"
            onClick={() => navigate("/models")}
          >
            {String(info.activeModel)}
          </button>
        </>
      )}
      <button
        type="button"
        className="ml-auto max-w-[50%] cursor-pointer truncate opacity-80 transition-colors duration-150 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        title={workspace?.path ? String(workspace.path) : "未绑定工作区"}
        onClick={() => void useAppStore.getState().openWorkspace()}
      >
        {workspace?.path ? shortPath(String(workspace.path), 56) : "未绑定工作区"}
      </button>
    </footer>
  );
}
