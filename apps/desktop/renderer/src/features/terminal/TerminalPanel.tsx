import { useCallback, useEffect, useRef, useState } from "react";
import { Plus, TerminalSquare, Trash2 } from "lucide-react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";
import { Button } from "@/components/ui/button";
import { ChipButton, EmptyState } from "@/components/ui/page-states";
import { getHfq, hasHfq, type PtySessionInfo } from "@/lib/hfq";
import { cn } from "@/lib/utils";
import { useTerminalStore } from "@/store/terminal-store";
import { useAppStore } from "@/store/app-store";

/** Per-session scrollback cache (UI side, complements BE ring). */
const scrollbackCache = new Map<string, string>();
const MAX_CACHE_BYTES = 512_000;
let totalCachedBytes = 0;

function appendCache(id: string, data: string) {
  const prev = scrollbackCache.get(id) ?? "";
  const next = prev + data;
  if (next.length > MAX_CACHE_BYTES) {
    // Drop oldest half when overflow
    const keep = next.slice(-Math.floor(MAX_CACHE_BYTES / 2));
    scrollbackCache.set(id, keep);
    totalCachedBytes = keep.length;
  } else {
    scrollbackCache.set(id, next);
    totalCachedBytes += data.length;
  }
}

function getCache(id: string): string {
  return scrollbackCache.get(id) ?? "";
}

function clearCache(id: string) {
  const prev = scrollbackCache.get(id) ?? "";
  totalCachedBytes -= prev.length;
  scrollbackCache.delete(id);
}

function clearAllCache() {
  scrollbackCache.clear();
  totalCachedBytes = 0;
}

function tabLabel(s: PtySessionInfo): string {
  return s.label || s.shellKind || (s.shell ? s.shell.split(/[/\\]/).pop() || s.shell : "") || s.id.slice(0, 6);
}

export function TerminalPanel() {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const activeIdRef = useRef<string | null>(null);
  const unsubData = useRef<(() => void) | null>(null);
  const unsubExit = useRef<(() => void) | null>(null);
  const [shellPick, setShellPick] = useState("auto");

  const sessions = useTerminalStore((s) => s.sessions);
  const activeId = useTerminalStore((s) => s.activeId);
  const shells = useTerminalStore((s) => s.shells);
  const preferred = useTerminalStore((s) => s.preferred);
  const bootstrap = useTerminalStore((s) => s.bootstrap);
  const create = useTerminalStore((s) => s.create);
  const kill = useTerminalStore((s) => s.kill);
  const setActive = useTerminalStore((s) => s.setActive);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  // Refresh pty list when workspace changes (killAll on workspace switch).
  const workspacePath = useAppStore((s) => s.workspace?.path);
  useEffect(() => {
    if (workspacePath) {
      clearAllCache();
      void useTerminalStore.getState().refresh();
    } else {
      // No workspace → no pty sessions expected.
      clearAllCache();
      useTerminalStore.setState({ sessions: [], activeId: null });
    }
  }, [workspacePath]);

  useEffect(() => {
    if (preferred) setShellPick(preferred);
  }, [preferred]);

  // Create xterm instance once.
  useEffect(() => {
    if (!hostRef.current || termRef.current) return;
    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      lineHeight: 1.35,
      fontFamily: "JetBrains Mono, Cascadia Code, Consolas, monospace",
      theme: {
        background: "#09090b",
        foreground: "#e4e4e7",
        cursor: "#e4e4e7",
        selectionBackground: "#3f3f46",
      },
      allowProposedApi: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(hostRef.current);
    fit.fit();
    termRef.current = term;
    fitRef.current = fit;

    term.onData((data) => {
      const id = activeIdRef.current;
      if (id && hasHfq()) void getHfq().ptyWrite({ id, data });
    });

    const onResize = () => {
      fit.fit();
      const id = activeIdRef.current;
      if (id && hasHfq() && term.cols && term.rows) {
        void getHfq().ptyResize({ id, cols: term.cols, rows: term.rows });
      }
    };
    window.addEventListener("resize", onResize);
    const ro = new ResizeObserver(onResize);
    ro.observe(hostRef.current);

    return () => {
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      term.dispose();
      termRef.current = null;
      fitRef.current = null;
    };
  }, []);

  // 1.1.9: Subscribe to onPtyData / onPtyExit once (module-level, not per-activeId).
  // Caches all output globally; writes to xterm only if currently active.
  useEffect(() => {
    if (!hasHfq()) return;
    const hfq = getHfq();
    const offData = hfq.onPtyData(({ id, data }) => {
      appendCache(id, data);
      if (id === activeIdRef.current && termRef.current) {
        termRef.current.write(data);
      }
    });
    const offExit = hfq.onPtyExit(({ id, exitCode }) => {
      const msg = `\r\n[进程退出: ${exitCode ?? "?"}]`;
      appendCache(id, msg);
      if (id === activeIdRef.current && termRef.current) {
        termRef.current.writeln(msg);
      }
      void useTerminalStore.getState().refresh();
    });
    return () => {
      offData();
      offExit();
    };
  }, []);

  /**
   * Restore xterm from BE ring (authoritative) then keep cache in sync.
   * FE cache alone is wrong after leaving Terminal: onPtyData is unsubscribed on unmount,
   * so only the main-process ring has output produced while away.
   */
  const restoreScrollback = useCallback(async (id: string) => {
    const term = termRef.current;
    if (!term || !hasHfq()) return;

    activeIdRef.current = id;
    term.reset();

    let painted = false;
    try {
      const sb = await getHfq().ptyGetScrollback({ id });
      if (activeIdRef.current !== id) return; // switched away mid-flight
      if (sb.truncated) term.writeln("[…更早输出已截断]");
      if (sb.data) {
        term.write(sb.data);
        // Replace cache with BE snapshot (not append — avoids duplicate tails).
        clearCache(id);
        if (sb.data) {
          scrollbackCache.set(id, sb.data);
          totalCachedBytes += sb.data.length;
        }
        painted = true;
      }
    } catch {
      // Dead / unknown id — fall back to any local cache, then refresh list.
      const cached = getCache(id);
      if (cached && activeIdRef.current === id) {
        term.write(cached);
        painted = true;
      }
      void useTerminalStore.getState().refresh();
    }

    // Cold race: BE empty but we already cached live data this mount.
    if (!painted) {
      const cached = getCache(id);
      if (cached) term.write(cached);
    }

    if (fitRef.current && activeIdRef.current === id) {
      fitRef.current.fit();
      const { cols, rows } = term;
      try {
        await getHfq().ptyResize({ id, cols, rows });
      } catch {
        /* best-effort */
      }
    }
  }, []);

  useEffect(() => {
    if (!activeId) {
      activeIdRef.current = null;
      return;
    }
    // Remount / tab switch / same-id re-entry: always re-attach from BE ring.
    void restoreScrollback(activeId);
  }, [activeId, restoreScrollback]);

  const shellOptions = [
    { kind: "auto", label: "auto" },
    ...shells
      .filter((s) => s.available !== false && s.kind && s.kind !== "auto")
      .map((s) => ({ kind: s.kind, label: s.label || s.kind })),
  ];

  const handleKill = async (id: string) => {
    clearCache(id);
    await kill(id);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 border-b border-border/70 px-1.5 py-1">
        <div className="flex min-w-0 flex-1 gap-0.5 overflow-x-auto">
          {sessions.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(s.id)}
              aria-pressed={s.id === activeId}
              className={cn(
                "interactive rounded-md px-2 py-0.5 text-xs",
                s.id === activeId
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
              )}
            >
              {tabLabel(s)}
              {s.alive === false && (
                <span className="ml-1 text-destructive" title="已退出">†</span>
              )}
            </button>
          ))}
          {sessions.length === 0 && (
            <span className="px-1.5 text-xs text-muted-foreground">无终端会话</span>
          )}
        </div>
        <div className="hidden items-center gap-0.5 sm:flex">
          {shellOptions.slice(0, 3).map((s) => (
            <ChipButton
              key={s.kind}
              active={shellPick === s.kind}
              className="h-6 px-1.5 py-0 text-xs"
              onClick={() => {
                setShellPick(s.kind);
                if (hasHfq()) {
                  void getHfq().setPrefs({
                    terminalShell: s.kind === "auto" ? "" : s.kind,
                  });
                }
              }}
            >
              {s.label}
            </ChipButton>
          ))}
        </div>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-8 w-8"
          title="新建终端"
          aria-label="新建终端"
          onClick={() =>
            void create({
              shell: shellPick === "auto" ? undefined : shellPick,
            })
          }
        >
          <Plus className="h-4 w-4" />
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          className="h-8 w-8"
          title="关闭当前终端"
          aria-label="关闭当前终端"
          disabled={!activeId}
          onClick={() => activeId && void handleKill(activeId)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
      <div className="relative min-h-0 flex-1 bg-[#09090b]">
        {sessions.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-4">
            <EmptyState
              icon={TerminalSquare}
              title="还没有终端"
              description="新建 PTY 会话以在工作区内执行命令"
              className="max-w-xs border-border/50 bg-card/40 py-8"
              action={
                <Button
                  size="sm"
                  onClick={() =>
                    void create({
                      shell: shellPick === "auto" ? undefined : shellPick,
                    })
                  }
                >
                  <Plus className="h-4 w-4" />
                  新建终端
                </Button>
              }
            />
          </div>
        )}
        <div ref={hostRef} className="h-full w-full p-1" />
      </div>
    </div>
  );
}
